const validity={not_yet_valid:'Not yet valid',in_date:'In date',expiring:'Expiring',expired:'Expired',dates_missing:'Dates missing'};
const verification={verified:'Evidence verified',recorded_unverified:'Evidence unverified',not_supplied:'Evidence not supplied'};
// This safe document projection deliberately omits card numbers, private notes and file IDs.
export function installationQualificationSummary(check){
  return (check?.members||[]).map(member=>({name:member.name,summary:member.qualifications.length?member.qualifications.map(item=>`${item.typeLabel}: ${validity[item.attendanceValidity||item.validityStatus]||'Dates missing'}; ${verification[item.verificationStatus]||'Evidence unverified'}${item.expiryDate?`; expires ${item.expiryDate}`:''}`).join(' · '):'No qualifications supplied'}));
}
