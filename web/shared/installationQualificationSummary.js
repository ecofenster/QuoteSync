const validity={not_yet_valid:'Not yet valid',in_date:'In date',expiring:'Expiring',expired:'Expired',dates_missing:'Dates missing'};
const verification={verified:'Evidence verified',recorded_unverified:'Evidence unverified',not_supplied:'Evidence not supplied'};
const coversAttendance=item=>['in_date','expiring'].includes(item.attendanceValidity||item.validityStatus)&&item.verificationStatus==='verified';
// Collapse only an explicit same-type renewal chain, never unrelated cards of the same type.
// Earlier verified evidence remains visible if a future/unverified renewal cannot cover attendance.
function relevantQualifications(items){
  const descendants=item=>{
    if(!item.id)return [];
    const found=[],seen=new Set([item.id]),pending=[item.id];
    while(pending.length){const id=pending.pop();for(const next of items){
      if(next.supersedesQualificationId!==id||next.typeCode!==item.typeCode)continue;
      if(seen.has(next.id))return []; // Malformed legacy lineage: retain all evidence for review.
      seen.add(next.id);found.push(next);pending.push(next.id);
    }}
    return found;
  };
  return items.filter(item=>{const newer=descendants(item);return !newer.length||(coversAttendance(item)&&!newer.some(coversAttendance));});
}
// This safe document projection deliberately omits card numbers, private notes and file IDs.
export function installationQualificationSummary(check){
  return (check?.members||[]).map(member=>{
    const all=member.qualifications||[],relevant=relevantQualifications(all);
    return {name:member.name,summary:relevant.length?relevant.map(item=>`${item.typeLabel}: ${validity[item.attendanceValidity||item.validityStatus]||'Dates missing'}; ${verification[item.verificationStatus]||'Evidence unverified'}${item.expiryDate?`; expires ${item.expiryDate}`:''}`).join(' · '):'No qualifications supplied'};
  });
}
