import {createHash} from 'node:crypto';
import {calculateInstallationProgramme} from '../projectCalculatorLab/installationProgramme.js';
import {validateInstallationDocumentCalculation} from './installationDocumentPreparation.js';
import {projectInstallationDocument} from './installationDocumentProjection.js';

const fail=message=>Object.assign(new Error(message),{status:409,code:'order_installation_plan_review'});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const included=item=>item.includedInCurrentEstimate!==false&&item.classification!=='alternative';

// Internal proposal only. Persistence/review must retain this binding; this function never edits the sold scenario.
export function buildOrderInstallationPlan(source,scenario,expectedRevision){
  if(!source?.orderId||!source.sourceReleaseId)throw fail('Open the accepted Order and its retained release before planning installation.');
  if(!scenario||scenario.estimateId!==source.estimateId||scenario.revisionNumber!==expectedRevision||!Number.isInteger(expectedRevision))throw fail('The saved installation calculation is unavailable or has changed. Reopen it for review.');
  const rules=scenario.catalogueSnapshot?.rules?.installation_programme_v1?.value,profile=scenario.options?.installationProfile;
  if(!rules||!scenario.options?.installationRequired||!profile||profile.enabled===false)throw fail('Select an enabled saved installation programme. Missing rules or disabled installation cannot become a new Order allowance.');
  if(!Array.isArray(source.positions)||!source.positions.length||!Array.isArray(scenario.products))throw fail('The accepted schedule or saved Position evidence is unavailable.');
  const accepted=new Set(source.positions.map(item=>item.id));
  if(accepted.size!==source.positions.length||accepted.has(undefined)||accepted.has(null)||accepted.has(''))throw fail('The accepted schedule has missing or repeated Position identities.');
  const selected=source.positions.map(position=>{
    const matches=scenario.products.filter(item=>item.estimatePositionId===position.id);
    if(matches.length!==1)throw fail(`Position ${position.reference||position.positionRef||'not confirmed'} needs one exact saved calculation row; found ${matches.length}. Review its source mapping.`);
    // Only the proposed operational scope changes. Retained source flags remain in the source fingerprint and evidence below.
    return {...structuredClone(matches[0]),includedInCurrentEstimate:true,classification:'standard'};
  });
  // This is an operational calculation view, not a cloned commercial scenario to insert into Project Costing.
  const proposed={id:scenario.id,estimateId:scenario.estimateId,revisionNumber:scenario.revisionNumber,products:selected,options:structuredClone(scenario.options),catalogueSnapshot:structuredClone(scenario.catalogueSnapshot),selectedInstallationTeam:structuredClone(scenario.selectedInstallationTeam||null),routeSnapshots:structuredClone(scenario.routeSnapshots||[])};
  validateInstallationDocumentCalculation(source,proposed,expectedRevision); // Requires identical quantities/dimensions and saved rules.
  const effectiveProfile={...profile,projectType:profile.projectType??scenario.options.projectType,buildingType:profile.buildingType??scenario.options.installationMaterials?.buildingType??null,sitePostcode:scenario.options.siteVisitTravel?.sitePostcode??profile.sitePostcode??null};
  proposed.installationProgramme=calculateInstallationProgramme({positions:selected,rules,profile:effectiveProfile,selectedTeam:scenario.selectedInstallationTeam||null});
  const scopeChanges={
    included:scenario.products.filter(item=>accepted.has(item.estimatePositionId)&&!included(item)).map(item=>({id:item.estimatePositionId,reference:item.displayReference||'Not confirmed',previousClassification:item.classification,previousIncluded:item.includedInCurrentEstimate})),
    excluded:scenario.products.filter(item=>!accepted.has(item.estimatePositionId)&&included(item)).map(item=>({id:item.estimatePositionId||null,reference:item.displayReference||'Not confirmed'})),
  };
  const binding={orderId:source.orderId,sourceReleaseId:source.sourceReleaseId,estimateId:source.estimateId,estimateRevision:source.revision,scenarioId:scenario.id,scenarioRevision:expectedRevision,sourceFingerprint:digest({source,scenario}),scopeChanges};
  const document=projectInstallationDocument({audience:'installer',revision:source,scenario:proposed});
  return {binding,proposedScenario:proposed,document,reviewRequired:proposed.installationProgramme.reviewRequired||[],proposalFingerprint:digest({binding,document,programme:proposed.installationProgramme})};
}
