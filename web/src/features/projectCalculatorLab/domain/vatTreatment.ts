export const VAT_TREATMENTS = Object.freeze({
  zero_rated: { label: "Zero Rated", percentage: "0" },
  reduced_rate: { label: "Reduced Rate", percentage: "5" },
  standard_rate: { label: "Standard Rate", percentage: "20" },
});
export type VatTreatmentCode=keyof typeof VAT_TREATMENTS;
export type VatTreatment={code:VatTreatmentCode;percentage:string;source:string;manuallyOverridden:boolean;capturedAt?:string;projectTypeAtSelection?:string};
export const vatRecommendation=(projectType:unknown):VatTreatmentCode=>projectType==="new_build"?"zero_rated":"standard_rate";
export function resolveVatTreatment(value:unknown,_projectType?:unknown):VatTreatment { const record=value&&typeof value==="object"?value as Record<string,unknown>:{},code=String(record.code??"") as VatTreatmentCode;if(code in VAT_TREATMENTS&&String(record.percentage)===VAT_TREATMENTS[code].percentage)return{code,percentage:VAT_TREATMENTS[code].percentage,source:String(record.source??"saved"),manuallyOverridden:Boolean(record.manuallyOverridden),capturedAt:typeof record.capturedAt==="string"?record.capturedAt:undefined,projectTypeAtSelection:typeof record.projectTypeAtSelection==="string"?record.projectTypeAtSelection:undefined};return{code:"standard_rate",percentage:VAT_TREATMENTS.standard_rate.percentage,source:"legacy_policy_default",manuallyOverridden:false}; }
