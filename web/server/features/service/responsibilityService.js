import { randomUUID } from "node:crypto";
import { CURRENT_APP_USER } from "../../currentUser.js";

export const RESPONSIBILITY_AREAS = Object.freeze(["enquiries", "estimates", "orders", "completed_aftercare", "lost_reengagement", "service"]);
const clean = (value) => String(value ?? "").trim();
const issue = (message, status = 422, code = "responsibility_invalid") => Object.assign(new Error(message), { status, code });

const assignmentProjection = (row) => row ? ({
  recordKind: row.record_kind, recordId: row.record_id, responsibilityArea: row.responsibility_area,
  teamId: row.team_id || null, teamName: row.team_name || null, assigneeId: row.assignee_id || null,
  assigneeName: row.assignee_name || null, routingState: row.routing_state, assignedAt: row.assigned_at, updatedAt: row.updated_at
}) : null;

export function createResponsibilityService(db, { id = randomUUID, clock = () => new Date() } = {}) {
  const now = () => clock().toISOString();
  async function listConfiguration() {
    const [teams, members, rules, unassigned] = await Promise.all([
      db.all("SELECT * FROM responsibility_teams ORDER BY active DESC,name"),
      db.all("SELECT * FROM responsibility_team_members ORDER BY active DESC,user_name"),
      db.all(`SELECT r.*,t.name team_name,t.active team_active,m.user_name default_assignee_name,m.active default_assignee_active
        FROM responsibility_routing_rules r JOIN responsibility_teams t ON t.id=r.team_id
        LEFT JOIN responsibility_team_members m ON m.team_id=r.team_id AND m.user_id=r.default_assignee_id
        WHERE r.active=1 ORDER BY r.responsibility_area,r.case_type`),
      db.all("SELECT * FROM record_assignments WHERE routing_state='unassigned' ORDER BY updated_at DESC LIMIT 100")
    ]);
    return {
      areas: RESPONSIBILITY_AREAS,
      teams: teams.map((team) => ({ id: team.id, name: team.name, active: Boolean(team.active), members: members.filter((member) => member.team_id === team.id).map((member) => ({ userId: member.user_id, userName: member.user_name, active: Boolean(member.active) })) })),
      rules: rules.map((rule) => ({ id: rule.id, responsibilityArea: rule.responsibility_area, caseType: rule.case_type || "", teamId: rule.team_id, teamName: rule.team_name, teamActive: Boolean(rule.team_active), defaultAssigneeId: rule.default_assignee_id || null, defaultAssigneeName: rule.default_assignee_name || null, valid: Boolean(rule.team_active) && (!rule.default_assignee_id || Boolean(rule.default_assignee_active)) })),
      unassigned: unassigned.map(assignmentProjection),
      currentUser: CURRENT_APP_USER
    };
  }

  async function saveTeam(input = {}) {
    const name = clean(input.name);
    if (!name) throw issue("Enter a team name.");
    const teamId = clean(input.id) || id(), at = now(), existing = await db.get("SELECT id FROM responsibility_teams WHERE id=?", teamId);
    if (existing) await db.run("UPDATE responsibility_teams SET name=?,active=?,updated_at=? WHERE id=?", name, input.active === false ? 0 : 1, at, teamId);
    else await db.run("INSERT INTO responsibility_teams(id,name,active,created_at,updated_at) VALUES(?,?,?,?,?)", teamId, name, input.active === false ? 0 : 1, at, at);
    const incoming = Array.isArray(input.members) ? input.members : [];
    for (const member of incoming) {
      const userId = clean(member.userId), userName = clean(member.userName);
      if (!userId || !userName) throw issue("Each team member needs a staff identity and name.");
      await db.run(`INSERT INTO responsibility_team_members(team_id,user_id,user_name,active,created_at,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(team_id,user_id) DO UPDATE SET user_name=excluded.user_name,active=excluded.active,updated_at=excluded.updated_at`, teamId, userId, userName, member.active === false ? 0 : 1, at, at);
    }
    return listConfiguration();
  }

  async function saveRoutingRule(input = {}) {
    const area = clean(input.responsibilityArea), caseType = clean(input.caseType), teamId = clean(input.teamId), assignee = clean(input.defaultAssigneeId) || null;
    if (!RESPONSIBILITY_AREAS.includes(area)) throw issue("Choose a valid responsibility area.");
    const team = await db.get("SELECT id,active FROM responsibility_teams WHERE id=?", teamId);
    if (!team?.active) throw issue("Choose an active responsible team.", 409, "responsibility_team_inactive");
    if (assignee && !(await db.get("SELECT user_id FROM responsibility_team_members WHERE team_id=? AND user_id=? AND active=1", teamId, assignee))) throw issue("The default person must be an active member of that team.", 409, "responsibility_assignee_invalid");
    const at = now();
    await db.run("UPDATE responsibility_routing_rules SET active=0,updated_at=? WHERE responsibility_area=? AND case_type=? AND active=1", at, area, caseType);
    await db.run("INSERT INTO responsibility_routing_rules(id,responsibility_area,case_type,team_id,default_assignee_id,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)", id(), area, caseType, teamId, assignee, at, at);
    return listConfiguration();
  }

  async function getAssignment(recordKind, recordId) {
    return assignmentProjection(await db.get("SELECT * FROM record_assignments WHERE record_kind=? AND record_id=?", clean(recordKind), clean(recordId)));
  }

  async function assign({ recordKind, recordId, responsibilityArea, teamId = null, assigneeId = null, reason = "Reviewed assignment", actorId = CURRENT_APP_USER.id, idempotencyKey }) {
    const kind = clean(recordKind), targetId = clean(recordId), area = clean(responsibilityArea), at = now();
    if (!kind || !targetId || !RESPONSIBILITY_AREAS.includes(area)) throw issue("Assignment requires a record and responsibility area.");
    const stableKey = clean(idempotencyKey) || `assign:${kind}:${targetId}:${area}:${teamId || "unassigned"}:${assigneeId || "team"}`;
    if (await db.get("SELECT id FROM assignment_history WHERE idempotency_key=?", stableKey)) return getAssignment(kind, targetId);
    const current = await db.get("SELECT * FROM record_assignments WHERE record_kind=? AND record_id=?", kind, targetId);
    let team = null, member = null;
    if (teamId) {
      team = await db.get("SELECT id,name,active FROM responsibility_teams WHERE id=?", clean(teamId));
      if (!team?.active) throw issue("The selected team is unavailable. Choose an active team.", 409, "responsibility_team_inactive");
      if (assigneeId) {
        member = await db.get("SELECT user_id,user_name,active FROM responsibility_team_members WHERE team_id=? AND user_id=?", team.id, clean(assigneeId));
        if (!member?.active) throw issue("The selected person is not an active member of that team.", 409, "responsibility_assignee_invalid");
      }
    }
    await db.run(`INSERT INTO record_assignments(record_kind,record_id,responsibility_area,team_id,team_name,assignee_id,assignee_name,routing_state,assigned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(record_kind,record_id) DO UPDATE SET responsibility_area=excluded.responsibility_area,team_id=excluded.team_id,team_name=excluded.team_name,assignee_id=excluded.assignee_id,assignee_name=excluded.assignee_name,routing_state=excluded.routing_state,updated_at=excluded.updated_at`, kind, targetId, area, team?.id || null, team?.name || null, member?.user_id || null, member?.user_name || null, team ? "assigned" : "unassigned", current?.assigned_at || at, at);
    await db.run(`INSERT INTO assignment_history(id,record_kind,record_id,responsibility_area,from_team_id,from_assignee_id,to_team_id,to_assignee_id,reason,actor_id,occurred_at,idempotency_key)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id(), kind, targetId, area, current?.team_id || null, current?.assignee_id || null, team?.id || null, member?.user_id || null, clean(reason) || "Reviewed assignment", clean(actorId) || CURRENT_APP_USER.id, at, stableKey);
    if (kind === "enquiry") await db.run("UPDATE crm_record_work_states SET owner_user_id=?,owner_name=?,updated_at=? WHERE record_kind='enquiry' AND record_id=?", member?.user_id || (team ? `team:${team.id}` : "unassigned"), member?.user_name || team?.name || "Unassigned", at, targetId);
    return getAssignment(kind, targetId);
  }

  async function route({ recordKind, recordId, responsibilityArea, caseType = "", transitionKey = "registered", actorId = "system" }) {
    const area = clean(responsibilityArea), type = clean(caseType);
    const rule = await db.get(`SELECT r.*,t.active team_active FROM responsibility_routing_rules r JOIN responsibility_teams t ON t.id=r.team_id
      WHERE r.responsibility_area=? AND r.active=1 AND t.active=1 AND r.case_type IN (?, '') ORDER BY CASE WHEN r.case_type=? THEN 0 ELSE 1 END LIMIT 1`, area, type, type);
    if (!rule) return assign({ recordKind, recordId, responsibilityArea: area, reason: "No valid routing rule is configured", actorId, idempotencyKey: `route:${recordKind}:${recordId}:${transitionKey}:unassigned` });
    const validAssignee = rule.default_assignee_id ? await db.get("SELECT user_id FROM responsibility_team_members WHERE team_id=? AND user_id=? AND active=1", rule.team_id, rule.default_assignee_id) : null;
    return assign({ recordKind, recordId, responsibilityArea: area, teamId: rule.team_id, assigneeId: validAssignee?.user_id || null, reason: `Configured ${area.replaceAll("_", " ")} routing`, actorId, idempotencyKey: `route:${recordKind}:${recordId}:${transitionKey}:${rule.id}` });
  }

  async function history(recordKind, recordId) {
    return db.all("SELECT * FROM assignment_history WHERE record_kind=? AND record_id=? ORDER BY occurred_at,id", clean(recordKind), clean(recordId));
  }
  return { listConfiguration, saveTeam, saveRoutingRule, getAssignment, assign, route, history };
}
