import { randomUUID } from 'node:crypto';

export const PRODUCT_CLASSES = Object.freeze(['Window','Single door','French/double door','Door with sidelight','Lift-and-slide','Bifold','Sliding/gliding door','Curtain walling','Other','Needs review']);
export const PACKAGE_CODES = Object.freeze(['supply_only','support','full_installation']);
export const COST_CATALOGUE = Object.freeze([
  ['materials','Materials'],['survey','Survey'],['installation_support','Installation support'],
  ['standard_window_installation','Standard window installation'],['retrofit_installation','Retrofit installation'],
  ['sliding_door_under_2_5m','Sliding-door installation under 2.5 m'],['sliding_door_over_2_5m','Sliding-door installation over 2.5 m'],
  ['cills','Cills'],['compriband','Compriband'],['membranes','Membranes'],['delivery','Delivery'],
  ['lifting_equipment','Lifting equipment'],['telehandler','Telehandler'],['mileage','Mileage'],
  ['accommodation','Accommodation'],['skip_hire','Skip hire'],['admin_storage','Admin / storage'],
]);
const PACKAGE_DEFAULTS=Object.freeze({supply_only:new Set(['delivery']),support:new Set(['survey','installation_support','delivery','mileage']),full_installation:new Set(COST_CATALOGUE.map(([code])=>code))});

function decimalFromMillionths(value) {
  const whole = value / 1000000n;
  const fraction = String(value % 1000000n).padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function calculateProductGeometry(widthMm, heightMm, quantity) {
  if (![widthMm, heightMm, quantity].every(Number.isSafeInteger) || widthMm <= 0 || heightMm <= 0 || quantity <= 0) throw Object.assign(new Error('Invalid product geometry.'), { code: 'invalid_geometry' });
  return {
    areaSquareMetres: decimalFromMillionths(BigInt(widthMm) * BigInt(heightMm) * BigInt(quantity)),
    framePerimeterMetres: decimalFromMillionths(2n * BigInt(widthMm + heightMm) * BigInt(quantity) * 1000n),
  };
}

const parseJson = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const scenarioMap = (row) => row && ({ id:row.id,name:row.name,currency:row.currency,packageCode:row.package_code,importLabSessionId:row.import_lab_session_id,extractionRunId:row.extraction_run_id,sourceAttachmentId:row.source_attachment_id,installationOpeningCount:row.installation_opening_count,createdAt:row.created_at,updatedAt:row.updated_at });
const productMap = (row) => ({ id:row.id,scenarioId:row.scenario_id,sourceRowId:row.source_row_id,sourceSnapshot:parseJson(row.source_snapshot_json),displayReference:row.display_reference,productClass:row.product_class,quantity:row.quantity,widthMm:row.width_mm,heightMm:row.height_mm,totalPrice:row.total_price_amount,currency:row.currency,areaSquareMetres:row.area_square_metres,framePerimeterMetres:row.frame_perimeter_metres });
const costMap = (row) => ({ id:row.id,scenarioId:row.scenario_id,sourceAdditionalCostId:row.source_additional_cost_id,sourceSnapshot:parseJson(row.source_snapshot_json),category:row.category,label:row.label,amount:row.amount,currency:row.currency });
const packageMap = (row) => ({ id:row.id,scenarioId:row.scenario_id,packageCode:row.package_code,catalogueCode:row.catalogue_code,label:row.label,included:!!row.included,unitCost:row.unit_cost_amount,currency:row.currency });
const routeMap = (row) => ({ id:row.id,scenarioId:row.scenario_id,direction:row.direction,origin:{label:row.origin_label,lat:row.origin_lat,lng:row.origin_lng},destination:{label:row.destination_label,lat:row.destination_lat,lng:row.destination_lng},distanceKm:row.distance_km,durationMinutes:row.duration_minutes,trafficDurationMinutes:row.traffic_duration_minutes,calculatedAt:row.calculated_at,integration:row.integration,manuallyOverridden:!!row.manually_overridden,overrideReason:row.override_reason });

export function createProjectCalculatorLabService(db) {
  async function getScenario(id) {
    const row = await db.get('SELECT * FROM project_calculator_lab_scenarios WHERE id = ?', id);
    if (!row) return null;
    const [products,costs,packageItems,routes,summary] = await Promise.all([
      db.all('SELECT * FROM project_calculator_lab_product_rows WHERE scenario_id = ? ORDER BY display_reference',id),
      db.all('SELECT * FROM project_calculator_lab_supplier_costs WHERE scenario_id = ? ORDER BY label',id),
      db.all('SELECT * FROM project_calculator_lab_package_items WHERE scenario_id = ? ORDER BY rowid',id),
      db.all('SELECT * FROM project_calculator_lab_route_snapshots WHERE scenario_id = ? ORDER BY calculated_at DESC',id),
      db.get('SELECT product_subtotal_amount, delivery_total_amount, final_supplier_total_amount, original_extracted_snapshot_json FROM supplier_import_lab_commercial_summaries WHERE extraction_run_id = ?',row.extraction_run_id),
    ]);
    return { ...scenarioMap(row), products:products.map(productMap), supplierCosts:costs.map(costMap), packageItems:packageItems.map(packageMap), routeSnapshots:routes.map(routeMap), supplierSummary: summary ? { productSubtotal:summary.product_subtotal_amount,deliveryTotal:summary.delivery_total_amount,finalSupplierTotal:summary.final_supplier_total_amount,originalSnapshot:parseJson(summary.original_extracted_snapshot_json) } : null };
  }

  return {
    listScenarios: async () => (await db.all('SELECT * FROM project_calculator_lab_scenarios ORDER BY updated_at DESC')).map(scenarioMap),
    getScenario,
    async listImportSources() {
      return db.all(`SELECT s.id sessionId,s.supplier_name supplierName,s.currency,r.id runId,r.attachment_id attachmentId,a.original_file_name attachmentFileName,r.completed_at completedAt,
        (SELECT COUNT(*) FROM supplier_import_lab_extracted_rows x WHERE x.extraction_run_id=r.id AND x.selected_for_future_use=1 AND x.status!='rejected') selectedRowCount
        FROM supplier_import_lab_extraction_runs r JOIN supplier_import_lab_sessions s ON s.id=r.session_id JOIN supplier_import_lab_attachments a ON a.id=r.attachment_id
        WHERE r.status IN ('completed','completed_with_warnings') ORDER BY r.completed_at DESC`);
    },
    async createScenario(input) {
      if (!PACKAGE_CODES.includes(input.packageCode)) throw Object.assign(new Error('Invalid package.'),{code:'invalid_scenario'});
      if (!String(input.name || '').trim() || !Number.isInteger(Number(input.installationOpeningCount || 0)) || Number(input.installationOpeningCount || 0) < 0) throw Object.assign(new Error('Scenario name and installation-opening count are invalid.'),{code:'invalid_scenario'});
      const run = await db.get(`SELECT r.*,s.currency FROM supplier_import_lab_extraction_runs r JOIN supplier_import_lab_sessions s ON s.id=r.session_id WHERE r.id=? AND r.session_id=? AND r.attachment_id=? AND r.status IN ('completed','completed_with_warnings')`,input.extractionRunId,input.importLabSessionId,input.sourceAttachmentId);
      if (!run) throw Object.assign(new Error('Completed extraction source not found.'),{code:'source_not_found'});
      const rows = await db.all("SELECT * FROM supplier_import_lab_extracted_rows WHERE extraction_run_id=? AND session_id=? AND selected_for_future_use=1 AND status!='rejected' ORDER BY ordinal",run.id,run.session_id);
      const costs = await db.all("SELECT * FROM supplier_import_lab_additional_cost_items WHERE extraction_run_id=? AND session_id=? AND selected_for_future_use=1 AND status!='rejected' ORDER BY ordinal",run.id,run.session_id);
      const id=randomUUID(), now=new Date().toISOString();
      await db.exec('BEGIN IMMEDIATE');
      try {
        await db.run('INSERT INTO project_calculator_lab_scenarios(id,name,currency,package_code,import_lab_session_id,extraction_run_id,source_attachment_id,installation_opening_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id,String(input.name||'').trim(),run.currency,input.packageCode,run.session_id,run.id,run.attachment_id,Number(input.installationOpeningCount||0),now,now);
        for (const row of rows) {
          if (!row.width_mm || !row.height_mm || !row.quantity) continue;
          const geometry=calculateProductGeometry(row.width_mm,row.height_mm,row.quantity);
          await db.run('INSERT INTO project_calculator_lab_product_rows(id,scenario_id,source_row_id,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',randomUUID(),id,row.id,JSON.stringify(row),row.display_reference||'Needs review','Needs review',row.quantity,row.width_mm,row.height_mm,row.total_price_amount,row.currency,geometry.areaSquareMetres,geometry.framePerimeterMetres,now,now);
        }
        for (const item of costs) await db.run('INSERT INTO project_calculator_lab_supplier_costs(id,scenario_id,source_additional_cost_id,source_snapshot_json,category,label,amount,currency,created_at) VALUES(?,?,?,?,?,?,?,?,?)',randomUUID(),id,item.id,JSON.stringify(item),item.category,item.original_description,item.total_price_amount,item.currency,now);
        for (const [code,label] of COST_CATALOGUE) await db.run('INSERT INTO project_calculator_lab_package_items(id,scenario_id,package_code,catalogue_code,label,included,unit_cost_amount,currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',randomUUID(),id,input.packageCode,code,label,PACKAGE_DEFAULTS[input.packageCode].has(code)?1:0,null,run.currency,now,now);
        await db.exec('COMMIT');
      } catch(error) { await db.exec('ROLLBACK'); throw error; }
      return getScenario(id);
    },
    async updateScenario(id,input) {
      const existing=await db.get('SELECT id FROM project_calculator_lab_scenarios WHERE id=?',id); if(!existing)return null;
      if(input.packageCode && !PACKAGE_CODES.includes(input.packageCode)) throw Object.assign(new Error('Invalid package.'),{code:'invalid_scenario'});
      await db.run('UPDATE project_calculator_lab_scenarios SET name=COALESCE(?,name),package_code=COALESCE(?,package_code),installation_opening_count=COALESCE(?,installation_opening_count),updated_at=? WHERE id=?',input.name?.trim()||null,input.packageCode||null,Number.isInteger(input.installationOpeningCount)?input.installationOpeningCount:null,new Date().toISOString(),id);
      return getScenario(id);
    },
    async updateProduct(id,rowId,input) {
      if (input.productClass && !PRODUCT_CLASSES.includes(input.productClass)) throw Object.assign(new Error('Invalid product class.'),{code:'invalid_product'});
      const result=await db.run('UPDATE project_calculator_lab_product_rows SET product_class=COALESCE(?,product_class),updated_at=? WHERE id=? AND scenario_id=?',input.productClass||null,new Date().toISOString(),rowId,id);
      return result.changes ? getScenario(id) : null;
    },
    async updatePackageItem(id,itemId,input) {
      const amount=input.unitCost;
      if(amount!=null && amount!=='' && !/^\d+(?:\.\d+)?$/.test(amount)) throw Object.assign(new Error('Invalid exact decimal cost.'),{code:'invalid_cost'});
      const result=await db.run('UPDATE project_calculator_lab_package_items SET included=COALESCE(?,included),unit_cost_amount=?,updated_at=? WHERE id=? AND scenario_id=?',typeof input.included==='boolean'?(input.included?1:0):null,amount===''?null:amount,new Date().toISOString(),itemId,id);
      return result.changes ? getScenario(id) : null;
    },
    async appendRouteSnapshot(id,input) {
      if(!['office_to_site','site_to_office'].includes(input.direction)) throw Object.assign(new Error('Invalid route direction.'),{code:'invalid_route'});
      const decimal=/^\d+(?:\.\d+)?$/;
      if(input.distanceKm!=null&&!decimal.test(String(input.distanceKm))) throw Object.assign(new Error('Invalid route distance.'),{code:'invalid_route'});
      if(input.manuallyOverridden&&!String(input.overrideReason||'').trim()) throw Object.assign(new Error('Manual route overrides require a reason.'),{code:'invalid_route'});
      const scenario=await db.get('SELECT id FROM project_calculator_lab_scenarios WHERE id=?',id); if(!scenario)return null;
      const snapshotId=randomUUID(), now=new Date().toISOString();
      await db.run('INSERT INTO project_calculator_lab_route_snapshots(id,scenario_id,direction,origin_label,destination_label,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,duration_minutes,traffic_duration_minutes,calculated_at,integration,manually_overridden,override_reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',snapshotId,id,input.direction,input.origin.label,String(input.origin.lat),String(input.origin.lng),input.destination.label,String(input.destination.lat),String(input.destination.lng),input.distanceKm==null?null:String(input.distanceKm),input.durationMinutes??null,input.trafficDurationMinutes??null,input.calculatedAt||now,input.integration,input.manuallyOverridden?1:0,input.overrideReason||null,now);
      return getScenario(id);
    },
  };
}
