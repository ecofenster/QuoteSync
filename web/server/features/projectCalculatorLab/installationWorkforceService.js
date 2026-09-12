import { randomUUID } from 'node:crypto';
import { INSTALLATION_CAPABILITIES } from './installationProgramme.js';

const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const capabilities = value => [...new Set((Array.isArray(value) ? value : []).filter(item => INSTALLATION_CAPABILITIES.includes(item)))];
const companyMap = row => row && ({ id:row.id,name:row.name,address:parse(row.address_json),postcode:row.postcode,telephone:row.telephone,email:row.email,notes:row.notes,dayRate:row.day_rate,active:!!row.active,version:row.version });
const installerMap = row => row && ({ id:row.id,companyId:row.company_id,name:row.name,mobile:row.mobile,email:row.email,address:parse(row.address_json),postcode:row.postcode,dayRate:row.day_rate,capabilities:parse(row.capabilities_json),active:!!row.active,version:row.version });
const teamMap = row => row && ({ id:row.id,companyId:row.company_id,companyName:row.company_name,name:row.name,normalCrewSize:row.normal_crew_size,baseAddress:parse(row.base_address_json),basePostcode:row.base_postcode,capabilities:parse(row.capabilities_json),active:!!row.active,version:row.version,installerIds:parse(row.installer_ids_json || '[]') });
const qualificationState = (row, attendanceDate = new Date().toISOString().slice(0,10), expiringDays = 30) => {
  if (!row.issue_date || !row.expiry_date) return 'dates_missing';
  if (attendanceDate < row.issue_date) return 'not_yet_valid';
  if (attendanceDate > row.expiry_date) return 'expired';
  const expiry = new Date(`${row.expiry_date}T23:59:59Z`), attendance = new Date(`${attendanceDate}T00:00:00Z`);
  return expiry.getTime() <= attendance.getTime() + expiringDays * 86400000 ? 'expiring' : 'in_date';
};
const qualificationMap = (row, attendanceDate) => row && ({
  id:row.id,installerId:row.installer_id,typeCode:row.qualification_type_code,typeLabel:row.qualification_type_label,
  occupationCategory:row.occupation_category||null,reference:row.reference||null,issuer:row.issuer||null,
  validFromDate:row.issue_date||null,issueDate:row.issue_date||null,expiryDate:row.expiry_date||null,evidenceDocumentId:row.evidence_document_id||null,
  evidenceFileName:row.evidence_file_name||null,verificationStatus:row.verification_status,
  validityStatus:qualificationState(row,attendanceDate),status:qualificationState(row,attendanceDate),verifiedBy:row.verified_by||null,verifiedAt:row.verified_at||null,
  verificationNotes:row.verification_notes||null,createdAt:row.created_at,updatedAt:row.updated_at,
  evidenceOpenUrl:row.evidence_open_url||null,renewalSequence:Number(row.renewal_sequence)||1,supersedesQualificationId:row.supersedes_qualification_id||null,isCurrent:row.is_current===undefined?true:!!row.is_current,
});
const required = (value, label) => { const result=String(value??'').trim(); if(!result)throw Object.assign(new Error(`${label} is required.`),{code:'invalid_installation_workforce'}); return result; };
const rate = value => { if(value==null||value==='')return null;if(!/^\d+(?:\.\d{1,2})?$/.test(String(value)))throw Object.assign(new Error('Day rate must be a non-negative amount with no more than two decimal places.'),{code:'invalid_installation_workforce'});return String(value); };

export function createInstallationWorkforceService(db) {
  const list = async () => {
    const [companies,installers,teams,qualificationTypes,qualificationRows] = await Promise.all([
      db.all('SELECT * FROM installation_companies ORDER BY active DESC,name'),
      db.all('SELECT * FROM installation_installers ORDER BY active DESC,name'),
      db.all(`SELECT t.*,c.name company_name,(SELECT json_group_array(installer_id) FROM installation_team_members m WHERE m.team_id=t.id) installer_ids_json FROM installation_teams t JOIN installation_companies c ON c.id=t.company_id ORDER BY t.active DESC,t.name`),
      db.all('SELECT * FROM installation_qualification_types ORDER BY active DESC,label'),
      db.all(`SELECT q.*,d.web_view_link evidence_open_url,NOT EXISTS(SELECT 1 FROM installation_installer_qualifications newer WHERE newer.supersedes_qualification_id=q.id) is_current FROM installation_installer_qualifications q LEFT JOIN canonical_documents d ON d.id=q.evidence_document_id ORDER BY q.renewal_sequence DESC,q.updated_at DESC`),
    ]);
    const qualifications=qualificationRows.map(row=>qualificationMap(row));
    return { companies:companies.map(companyMap),installers:installers.map(row=>({...installerMap(row),qualificationBadges:qualifications.filter(item=>item.installerId===row.id&&item.isCurrent).map(item=>({typeCode:item.typeCode,label:item.typeLabel,validityStatus:item.validityStatus,verificationStatus:item.verificationStatus,expiryDate:item.expiryDate}))})),teams:teams.map(teamMap),capabilities:INSTALLATION_CAPABILITIES,qualificationTypes:qualificationTypes.map(row=>({code:row.code,label:row.label,occupationSupported:!!row.occupation_supported,active:!!row.active})),qualifications };
  };
  return {
    list,
    async saveCompany(input) { const id=input.id||randomUUID(),now=new Date().toISOString(),existing=await db.get('SELECT id FROM installation_companies WHERE id=?',id);await db.run(existing?'UPDATE installation_companies SET name=?,address_json=?,postcode=?,telephone=?,email=?,notes=?,day_rate=?,active=?,version=version+1,updated_at=? WHERE id=?':'INSERT INTO installation_companies(name,address_json,postcode,telephone,email,notes,day_rate,active,version,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?,1,?,?,?)',required(input.name,'Company name'),JSON.stringify(input.address||{}),input.postcode||null,input.telephone||null,input.email||null,input.notes||null,rate(input.dayRate),input.active===false?0:1,...(existing?[now,id]:[now,now,id]));return list(); },
    async saveInstaller(input) { const id=input.id||randomUUID(),companyId=required(input.companyId,'Installation Company'),now=new Date().toISOString();if(!await db.get('SELECT id FROM installation_companies WHERE id=?',companyId))throw Object.assign(new Error('Installation Company was not found.'),{code:'invalid_installation_workforce'});const existing=await db.get('SELECT id FROM installation_installers WHERE id=?',id);await db.run(existing?'UPDATE installation_installers SET company_id=?,name=?,mobile=?,email=?,address_json=?,postcode=?,day_rate=?,capabilities_json=?,active=?,version=version+1,updated_at=? WHERE id=?':'INSERT INTO installation_installers(company_id,name,mobile,email,address_json,postcode,day_rate,capabilities_json,active,version,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)',companyId,required(input.name,'Installer name'),input.mobile||null,input.email||null,JSON.stringify(input.address||{}),input.postcode||null,rate(input.dayRate),JSON.stringify(capabilities(input.capabilities)),input.active===false?0:1,...(existing?[now,id]:[now,now,id]));return list(); },
    async saveTeam(input) { const id=input.id||randomUUID(),companyId=required(input.companyId,'Installation Company'),crew=Number(input.normalCrewSize);if(!Number.isInteger(crew)||crew<1)throw Object.assign(new Error('Normal crew size must be a positive integer.'),{code:'invalid_installation_workforce'});const installerIds=[...new Set(Array.isArray(input.installerIds)?input.installerIds:[])],now=new Date().toISOString();for(const installerId of installerIds)if(!await db.get('SELECT id FROM installation_installers WHERE id=? AND company_id=?',installerId,companyId))throw Object.assign(new Error('Every team member must belong to the selected Installation Company.'),{code:'invalid_installation_workforce'});const existing=await db.get('SELECT id FROM installation_teams WHERE id=?',id);await db.exec('BEGIN IMMEDIATE');try{await db.run(existing?'UPDATE installation_teams SET company_id=?,name=?,normal_crew_size=?,base_address_json=?,base_postcode=?,capabilities_json=?,active=?,version=version+1,updated_at=? WHERE id=?':'INSERT INTO installation_teams(company_id,name,normal_crew_size,base_address_json,base_postcode,capabilities_json,active,version,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,1,?,?,?)',companyId,required(input.name,'Team name'),crew,JSON.stringify(input.baseAddress||{}),input.basePostcode||null,JSON.stringify(capabilities(input.capabilities)),input.active===false?0:1,...(existing?[now,id]:[now,now,id]));await db.run('DELETE FROM installation_team_members WHERE team_id=?',id);for(const installerId of installerIds)await db.run('INSERT INTO installation_team_members(team_id,installer_id,created_at) VALUES(?,?,?)',id,installerId,now);await db.exec('COMMIT');}catch(error){await db.exec('ROLLBACK');throw error;}return list(); },
    async saveQualificationType(input) {
      const code=required(input.code,'Qualification code').toLowerCase().replace(/[^a-z0-9_-]+/g,'_'),label=required(input.label,'Qualification name'),now=new Date().toISOString();
      await db.run(`INSERT INTO installation_qualification_types(code,label,occupation_supported,active,created_at,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(code) DO UPDATE SET label=excluded.label,occupation_supported=excluded.occupation_supported,active=excluded.active,updated_at=excluded.updated_at`,code,label,input.occupationSupported?1:0,input.active===false?0:1,now,now);
      return list();
    },
    async saveQualification(input) {
      const installerId=required(input.installerId,'Installer'),typeCode=required(input.typeCode,'Qualification type'),now=new Date().toISOString(),renewalOfId=input.renewalOfId?String(input.renewalOfId):null,qualificationId=input.id||randomUUID();
      if(!await db.get('SELECT id FROM installation_installers WHERE id=?',installerId))throw Object.assign(new Error('Installer was not found.'),{code:'invalid_installation_workforce'});
      const type=await db.get('SELECT * FROM installation_qualification_types WHERE code=? AND active=1',typeCode);
      if(!type)throw Object.assign(new Error('Choose an active qualification type.'),{code:'invalid_installation_workforce'});
      const verificationStatus=['recorded_unverified','verified','not_supplied'].includes(input.verificationStatus)?input.verificationStatus:'recorded_unverified';
      let evidence=null;if(input.evidenceDocumentId){evidence=await db.get('SELECT id,file_name FROM canonical_documents WHERE id=? AND removed_at IS NULL AND trashed=0',String(input.evidenceDocumentId));if(!evidence)throw Object.assign(new Error('The selected evidence file is unavailable. Upload it through Files, then select that retained document.'),{code:'invalid_installation_workforce'});}
      if(verificationStatus==='verified'&&!evidence)throw Object.assign(new Error('Verified qualifications require retained evidence.'),{code:'invalid_installation_workforce'});
      const validFrom=input.validFromDate||input.issueDate||null;
      if(validFrom&&input.expiryDate&&String(input.expiryDate)<String(validFrom))throw Object.assign(new Error('Expiry date cannot be before the valid-from date.'),{code:'invalid_installation_workforce'});
      let renewalSequence=1;if(renewalOfId){const previous=await db.get('SELECT * FROM installation_installer_qualifications WHERE id=? AND installer_id=? AND qualification_type_code=?',renewalOfId,installerId,typeCode);if(!previous)throw Object.assign(new Error('The qualification renewal source was not found.'),{code:'invalid_installation_workforce'});renewalSequence=Number(previous.renewal_sequence||1)+1;}
      const existing=renewalOfId?null:await db.get('SELECT id FROM installation_installer_qualifications WHERE id=?',qualificationId),verifiedAt=verificationStatus==='verified'?(input.verifiedAt||now):null,verifiedBy=verificationStatus==='verified'?(input.verifiedBy||'User'):null;
      const values=[installerId,typeCode,type.label,input.occupationCategory||null,input.reference||null,input.issuer||null,validFrom,input.expiryDate||null,evidence?.id||null,evidence?.file_name||null,verificationStatus,verifiedBy,verifiedAt,input.verificationNotes||null,renewalOfId,renewalSequence,now];
      if(existing)await db.run('UPDATE installation_installer_qualifications SET installer_id=?,qualification_type_code=?,qualification_type_label=?,occupation_category=?,reference=?,issuer=?,issue_date=?,expiry_date=?,evidence_document_id=?,evidence_file_name=?,verification_status=?,verified_by=?,verified_at=?,verification_notes=?,updated_at=? WHERE id=?',...values.slice(0,14),now,qualificationId);
      else await db.run('INSERT INTO installation_installer_qualifications(installer_id,qualification_type_code,qualification_type_label,occupation_category,reference,issuer,issue_date,expiry_date,evidence_document_id,evidence_file_name,verification_status,verified_by,verified_at,verification_notes,supersedes_qualification_id,renewal_sequence,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',...values.slice(0,16),now,now,qualificationId);
      return list();
    },
    async qualificationCheck(teamId,{attendanceStart,attendanceEnd,requiredTypes=[]}={}) {
      const start=required(attendanceStart,'Attendance start date'),end=required(attendanceEnd||attendanceStart,'Attendance end date');
      if(end<start)throw Object.assign(new Error('Attendance end cannot be before the start date.'),{code:'invalid_installation_workforce'});
      const team=await db.get('SELECT id,name FROM installation_teams WHERE id=?',teamId);if(!team)throw Object.assign(new Error('Installation Team was not found.'),{code:'invalid_installation_workforce'});
      const members=await db.all(`SELECT i.* FROM installation_installers i JOIN installation_team_members m ON m.installer_id=i.id WHERE m.team_id=? AND i.active=1 ORDER BY i.name`,teamId),all=await db.all(`SELECT q.* FROM installation_installer_qualifications q JOIN installation_team_members m ON m.installer_id=q.installer_id WHERE m.team_id=?`,teamId);
      const requiredCodes=[...new Set((Array.isArray(requiredTypes)?requiredTypes:[]).map(value=>String(value).trim()).filter(Boolean))],memberResults=members.map(member=>{const qualifications=all.filter(row=>row.installer_id===member.id).map(row=>({...qualificationMap(row,start),attendanceValidity:!row.issue_date||!row.expiry_date?'dates_missing':start<row.issue_date?'not_yet_valid':end>row.expiry_date?'expired':qualificationState(row,start)}));const gaps=requiredCodes.filter(code=>!qualifications.some(item=>item.typeCode===code&&item.verificationStatus==='verified'&&['in_date','expiring'].includes(item.attendanceValidity)));return{id:member.id,name:member.name,qualifications,gaps};});
      const gaps=memberResults.flatMap(member=>member.gaps.map(code=>`${member.name}: ${code.toUpperCase()} is not verified for ${start}.`));
      return {teamId:team.id,teamName:team.name,attendanceStart:start,attendanceEnd:end,members:memberResults,gaps,status:gaps.length?'review_required':'available'};
    },
    async snapshotQualificationCheck(input) {
      const check=await this.qualificationCheck(input.teamId,input),recordKind=['estimate','order','installer_pack'].includes(input.recordKind)?input.recordKind:'estimate',recordId=required(input.recordId,'Record'),revision=Math.max(0,Number(input.recordRevision)||0),now=new Date().toISOString(),snapshotId=randomUUID();
      const existing=await db.get('SELECT id,snapshot_json FROM installation_qualification_snapshots WHERE record_kind=? AND record_id=? AND record_revision=? AND team_id=? AND attendance_start=? AND attendance_end=?',recordKind,recordId,revision,input.teamId,check.attendanceStart,check.attendanceEnd);
      if(existing)return{...check,snapshotId:existing.id,snapshot:parse(existing.snapshot_json)};
      await db.run('INSERT INTO installation_qualification_snapshots(id,record_kind,record_id,record_revision,team_id,attendance_start,attendance_end,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',snapshotId,recordKind,recordId,revision,input.teamId,check.attendanceStart,check.attendanceEnd,JSON.stringify(check),input.createdBy||'User',now);
      return{...check,snapshotId,snapshot:check};
    },
  };
}
