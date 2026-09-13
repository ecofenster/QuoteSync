import {installationQualificationSummary} from '../../../shared/installationQualificationSummary.js';
import {projectInstallationMaterials} from './installationMaterialProjection.js';
import {projectInstallationPositionWeight} from './installationPositionWeight.js';

const text=value=>typeof value==='string'?value.trim():'';
const amount=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const pick=(object,keys)=>Object.fromEntries(keys.map(key=>[key,amount(object?.[key])]));
const category=position=>{
  const imported=position.origin==='supplier_imported'||position.sourceProvenance?.kind==='supplier_quote_position';
  // Imported positionType historically defaults to Window even for supplier doors.
  // Only an explicit product label may fill the absent category; descriptions and
  // product-system marketing names are not classification evidence.
  const sourceProduct=text(position.product).toLowerCase().replaceAll('_',' ');
  const explicitProduct=/^(?:window|door|single door|double door|sliding door|lift[ -](?:and[ -])?slide door|bifold(?: door)?)$/.test(sourceProduct)?sourceProduct:'';
  const value=text(position.productClass||position.productType||(imported?explicitProduct:'')).toLowerCase().replaceAll('_',' ');
  if(/lift[ -]?(?:and[ -]?)?slide/.test(value))return 'liftAndSlideDoors';
  if(/bi[ -]?fold/.test(value))return 'bifolds';
  if(/sliding|gliding/.test(value))return 'slidingDoors';
  if(/\bdoor\b/.test(value))return 'doors';
  if(/\bwindow\b/.test(value))return 'windows';
  return 'notConfirmed';
};

// Input is a selected canonical revision and its saved costing projection, not a browser pack draft.
// Deliberately do not spread Position, costing, qualification or installation objects into output.
export function projectInstallationDocument({audience,revision,scenario,qualificationCheck=null}){
  if(!['installer','client'].includes(audience))throw new Error('Choose installer pack or client price-free schedule.');
  if(!revision?.estimateId||revision.revision===undefined||!Array.isArray(revision.positions))throw new Error('Select the exact Estimate/Order revision and its retained schedule.');
  if(scenario&&scenario.estimateId!==revision.estimateId)throw new Error('The installation calculation belongs to another Estimate.');
  const ids=new Set(),totals={windows:0,doors:0,slidingDoors:0,liftAndSlideDoors:0,bifolds:0,notConfirmed:0};
  const positions=revision.positions.filter(item=>revision.orderId||item.includedInCurrentEstimate!==false&&item.classification!=='alternative').map(item=>{
    if(!item.id||ids.has(item.id))throw new Error('The schedule has a missing or repeated Position identity. Review the selected revision.');
    ids.add(item.id);const group=category(item),quantity=amount(item.quantity);
    if(quantity!==null)totals[group]+=quantity;
    return {id:item.id,reference:text(item.reference||item.positionRef),quantity,widthMm:amount(item.widthMm),heightMm:amount(item.heightMm),category:group,manufacturer:text(item.manufacturerName),system:text(item.productSystem||item.system),opening:text(item.openingType),room:text(item.roomName||item.room),floor:text(item.floor)};
  });
  if(!positions.length)throw new Error('The selected revision has no included Positions.');
  const document={schemaVersion:1,audience,estimateId:revision.estimateId,orderId:revision.orderId||null,reference:text(revision.orderReference||revision.estimateReference),revision:revision.revision,clientName:text(revision.clientName),projectName:text(revision.projectName),siteAddress:text(revision.siteAddress),positions,totals};
  if(audience==='client')return document;
  for(const position of positions)position.weight=projectInstallationPositionWeight(position,scenario);
  const programme=scenario?.installationProgramme,profile=scenario?.options?.installationProfile||{},allowances=programme?.allowances,route=(scenario?.routeSnapshots||[]).find(item=>item.id===profile.route?.snapshotId);
  const departure=text(route?.origin?.label),destination=text(route?.destination?.label);
  const routeAvailable=!!departure&&!!destination&&amount(route?.durationMinutes)!==null&&(!route.manuallyOverridden||!!text(route.overrideReason));
  document.installation={
    scenarioId:scenario?.id||null,scenarioRevision:scenario?.revisionNumber??null,
    teamName:text(scenario?.selectedInstallationTeam?.name),companyName:text(scenario?.selectedInstallationTeam?.companyName),
    ...pick(programme,['productivityCrewSize','costedCrewSize','installationDays','programmeDays']),
    allowances:pick(allowances,['nights','accommodationPersonNights','accommodationRate','foodDays','costedPersonDays','cillApplicableQuantity','cillInstallationRate']),
    foodAllowance:amount(programme?.costs?.food),accommodationAllowance:amount(programme?.costs?.accommodation),cillAllowance:amount(programme?.costs?.cillInstallation),
    inclusions:Object.fromEntries(['food','accommodation','cillInstallation','liftingEquipment','skipHire'].map(key=>[key,typeof programme?.componentInclusions?.[key]==='boolean'?programme.componentInclusions[key]:null])),
    travel:{status:routeAvailable?'Retained route estimate':'Travel time not confirmed',departure,destination,oneWayMinutes:routeAvailable?amount(route.durationMinutes):null,returnMinutes:null,pattern:['daily_travel','stay_away'].includes(profile.travelMode)?profile.travelMode:null,basis:routeAvailable?(route.manuallyOverridden?text(route.overrideReason):text(route.integration)):null,capturedAt:routeAvailable?text(route.calculatedAt):null},
    qualificationSummary:installationQualificationSummary(qualificationCheck),
    materials:projectInstallationMaterials(scenario?.installationMaterials),
  };
  return document;
}
