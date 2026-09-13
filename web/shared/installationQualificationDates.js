export function isQualificationDate(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
export function qualificationValidity(validFrom,expiry,onDate=new Date().toISOString().slice(0,10),expiringDays=30){
  if(!isQualificationDate(validFrom)||!isQualificationDate(expiry)||!isQualificationDate(onDate)||expiry<validFrom)return 'dates_missing';
  if(onDate<validFrom)return 'not_yet_valid';
  if(onDate>expiry)return 'expired';
  return (Date.parse(expiry)-Date.parse(onDate))/86400000<=expiringDays?'expiring':'in_date';
}
