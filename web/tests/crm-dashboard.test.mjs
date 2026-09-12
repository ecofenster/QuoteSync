import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createCrmDashboardRouter } from "../server/routes/crmDashboard.js";

async function fixture(t) {
  const db = await open({ filename: ":memory:", driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,company_name TEXT,contact_name TEXT,email TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE enquiries(id TEXT PRIMARY KEY,enquiry_ref TEXT,status TEXT,display_name TEXT,company_name TEXT,email TEXT,project_name TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT,converted_client_id TEXT);
    CREATE TABLE projects(id TEXT PRIMARY KEY,client_id TEXT,name TEXT,site_address TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,outcome TEXT,status TEXT,positions_json TEXT,order_meta_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY,order_ref TEXT,client_id TEXT,project_id TEXT,source_estimate_id TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,issued_quotation_id TEXT,updated_at TEXT);
    CREATE TABLE crm_record_work_states(record_kind TEXT,record_id TEXT,owner_user_id TEXT,owner_name TEXT,stage TEXT,waiting_for TEXT,next_action TEXT,due_at TEXT,last_contact_at TEXT,created_at TEXT,updated_at TEXT,PRIMARY KEY(record_kind,record_id));
    CREATE TABLE communication_messages(id TEXT PRIMARY KEY,direction TEXT,subject TEXT,links_json TEXT,sent_at TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE workflow_events(id TEXT PRIMARY KEY,event_name TEXT,occurred_at TEXT,links_json TEXT);
    CREATE TABLE issued_quotations(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT);
    CREATE TABLE estimate_archives(estimate_id TEXT PRIMARY KEY);
    CREATE TABLE estimate_revision_releases(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_id TEXT);
    CREATE TABLE supplier_revision_requests(id TEXT PRIMARY KEY,review_submission_id TEXT,source_release_id TEXT,successor_estimate_id TEXT,status TEXT,workflow_state TEXT,response_due_at TEXT,responsible_user_id TEXT,created_at TEXT);
    INSERT INTO clients VALUES('c1','EF-CL-900','Alex Example','','','alex@example.test','2026-09-01T09:00:00.000Z','2026-09-10T09:00:00.000Z',NULL);
    INSERT INTO enquiries VALUES('en1','EF-ENQ-900','new','Alex Example','','alex@example.test','Test House','2026-09-10T09:00:00.000Z','2026-09-10T09:00:00.000Z',NULL,NULL);
    INSERT INTO projects VALUES('p1','c1','Test House','1 Test Road','2026-09-01T09:00:00.000Z','2026-09-10T09:00:00.000Z',NULL);
    INSERT INTO estimates VALUES('e1','c1','p1','EF-EST-TEST-001','Open','Draft','[]','{}','2026-09-01T09:00:00.000Z','2026-09-10T09:00:00.000Z',NULL);
    INSERT INTO followups VALUES('f1','c1','e1','Call Alex','Discuss options','2026-09-10T12:00:00.000Z','pending',NULL,'2026-09-10T09:00:00.000Z');
    INSERT INTO crm_record_work_states VALUES('enquiry','en1','user-1','User','new_enquiry','none','Review and qualify enquiry','2026-09-11T12:00:00.000Z',NULL,'2026-09-10T09:00:00.000Z','2026-09-10T09:00:00.000Z');
    INSERT INTO estimate_revision_releases VALUES('rel1','c1','p1','e1');
    INSERT INTO supplier_revision_requests VALUES('sr1','review1','rel1','e1','approved','prepared_for_review',NULL,'user-1','2026-09-11T09:30:00.000Z');
  `);
  const app = express(); app.use(express.json());
  app.use("/api/crm", createCrmDashboardRouter({ databasePromise: Promise.resolve(db), serviceOptions: { now: () => new Date("2026-09-11T10:00:00.000Z") } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await db.close(); });
  return { db, base };
}

test("dashboard projects canonical overdue, unanswered and exact-record actions", async (t) => {
  const { db, base } = await fixture(t);
  const first = await fetch(`${base}/api/crm/dashboard`);
  assert.equal(first.status, 200);
  const dashboard = await first.json();
  assert.equal(dashboard.summary.overdue, 1);
  assert.equal(dashboard.summary.dueToday, 1);
  assert.equal(dashboard.summary.unansweredEnquiries, 1);
  assert.equal(dashboard.summary.revisionsRequested, 1);
  assert.deepEqual(dashboard.attention.find((item) => item.id === "revision:sr1").target, { kind: "revision_request", id: "review1", clientId: "c1", projectId: "p1", estimateId: "e1" });
  assert.deepEqual(dashboard.attention.find((item) => item.id === "followup:f1").target, { kind: "followup", id: "f1", clientId: "c1", estimateId: "e1", projectId: "p1", dueAt: "2026-09-10T12:00:00.000Z" });
  assert.equal(dashboard.pipeline.find((stage) => stage.id === "draft_estimate").count, 1);

  await db.run("INSERT INTO communication_messages VALUES(?,?,?,?,?,?,?)", "m1", "outbound", "Re: Test House", JSON.stringify([{ kind: "enquiry", id: "en1" }]), "2026-09-11T10:15:00.000Z", "2026-09-11T10:15:00.000Z", "2026-09-11T10:15:00.000Z");
  const refreshed = await (await fetch(`${base}/api/crm/dashboard`)).json();
  assert.equal(refreshed.summary.unansweredEnquiries, 0);
});

test("search is bounded and work-state updates preserve the selected record", async (t) => {
  const { db, base } = await fixture(t);
  const search = await (await fetch(`${base}/api/crm/search?q=Test&limit=3`)).json();
  assert.equal(search.limit, 3);
  assert.ok(search.results.length <= 3);
  assert.ok(search.results.some((result) => result.target.clientId === "c1"));

  const saved = await fetch(`${base}/api/crm/work-state/enquiry/en1`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waitingFor: "customer", nextAction: "Confirm appointment", dueAt: "2026-09-12T09:00:00.000Z" }) });
  assert.equal(saved.status, 200);
  const row = await db.get("SELECT * FROM crm_record_work_states WHERE record_kind='enquiry' AND record_id='en1'");
  assert.equal(row.waiting_for, "customer");
  assert.equal(row.next_action, "Confirm appointment");

  const missing = await fetch(`${base}/api/crm/work-state/enquiry/not-there`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(missing.status, 404);
});
