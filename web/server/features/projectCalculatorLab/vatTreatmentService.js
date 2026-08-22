const parse=value=>{try{return JSON.parse(value||'{}')}catch{return{}}};
export const VAT_TREATMENTS=Object.freeze({zero_rated:'0',reduced_rate:'5',standard_rate:'20'});

export function createVatTreatmentService(db){
  return {async update(scenarioId,input){
    const existing=await db.get('SELECT project_type,options_json FROM project_calculator_lab_options WHERE scenario_id=?',scenarioId);if(!existing)return false;
    const code=String(input.code||''),percentage=VAT_TREATMENTS[code];
    if(percentage==null||String(input.percentage)!==percentage)throw Object.assign(new Error('VAT Treatment must be Zero Rated, Reduced Rate or Standard Rate.'),{code:'invalid_options'});
    const details=parse(existing.options_json),now=new Date().toISOString();
    details.vatTreatment={code,percentage,source:String(input.source||'manual_override'),manuallyOverridden:Boolean(input.manuallyOverridden),capturedAt:now,projectTypeAtSelection:existing.project_type};
    await db.run('UPDATE project_calculator_lab_options SET options_json=?,updated_at=? WHERE scenario_id=?',JSON.stringify(details),now,scenarioId);
    return true;
  }};
}
