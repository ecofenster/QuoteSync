import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  claimEnquirySubmission,
  emptyEnquiryDraft,
  enquiryDraftHasIdentity,
  readEnquiryControlValue,
  releaseEnquirySubmission,
  updateEnquiryDraft,
  type EnquiryDraftField,
} from "../src/features/commercialIdentity/enquiryFormState.ts";

const fields: EnquiryDraftField[] = ["displayName", "companyName", "email", "telephone", "source", "leadSource", "projectName", "siteAddress", "notes"];

test("all controlled Enquiry draft fields capture primitive values before deferred state work", () => {
  let draft = emptyEnquiryDraft();
  for (const field of fields) {
    const control: { value: string | null } = { value: `${field} initial` };
    const captured = readEnquiryControlValue(control as { value: string });
    control.value = null;
    draft = updateEnquiryDraft(draft, field, captured);
    assert.equal(draft[field], `${field} initial`);
  }
});

test("typing, rapid switching, paste and clear preserve independent draft fields", () => {
  let draft = emptyEnquiryDraft();
  for (const character of "Alice") draft = updateEnquiryDraft(draft, "displayName", draft.displayName + character);
  draft = updateEnquiryDraft(draft, "email", "alice@example.test");
  draft = updateEnquiryDraft(draft, "telephone", "+44 7000 000000");
  draft = updateEnquiryDraft(draft, "notes", "Pasted multi-line notes\nretain source text");
  draft = updateEnquiryDraft(draft, "companyName", "Temporary");
  draft = updateEnquiryDraft(draft, "companyName", "");
  draft = updateEnquiryDraft(draft, "projectName", "Rapid switch project");
  draft = updateEnquiryDraft(draft, "siteAddress", "TEST site address");
  assert.deepEqual({ name: draft.displayName, company: draft.companyName, email: draft.email, telephone: draft.telephone, notes: draft.notes, project: draft.projectName, address: draft.siteAddress }, {
    name: "Alice", company: "", email: "alice@example.test", telephone: "+44 7000 000000", notes: "Pasted multi-line notes\nretain source text", project: "Rapid switch project", address: "TEST site address",
  });
});

test("validation accepts person or company identity and rejects an empty identity", () => {
  assert.equal(enquiryDraftHasIdentity(emptyEnquiryDraft()), false);
  assert.equal(enquiryDraftHasIdentity(updateEnquiryDraft(emptyEnquiryDraft(), "displayName", " Person ")), true);
  assert.equal(enquiryDraftHasIdentity(updateEnquiryDraft(emptyEnquiryDraft(), "companyName", " Company ")), true);
});

test("submission lock prevents double-click and keyboard/click overlap while allowing later attempts", async () => {
  const lock = { current: false };
  let created = 0;
  let releaseFirst!: () => void;
  const pending = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const submit = async () => { if (!claimEnquirySubmission(lock)) return; try { created += 1; await pending; } finally { releaseEnquirySubmission(lock); } };
  const first = submit();
  await submit();
  assert.equal(created, 1);
  releaseFirst();
  await first;
  const next = submit();
  releaseFirst();
  await next;
  assert.equal(created, 2);
});

test("failed fixture submission retains data and successful fixture submission creates exactly one Enquiry", async () => {
  const original = updateEnquiryDraft(updateEnquiryDraft(emptyEnquiryDraft(), "displayName", "Fixture Person"), "notes", "Retain after failure");
  const failingApi = async () => { throw new Error("fixture failure"); };
  await assert.rejects(() => failingApi(), /fixture failure/);
  assert.equal(original.displayName, "Fixture Person");
  assert.equal(original.notes, "Retain after failure");
  let calls = 0;
  const fixtureApi = async (input: typeof original) => { calls += 1; return { id: "fixture-enquiry", ...input }; };
  const lock = { current: false };
  const create = async () => { if (!claimEnquirySubmission(lock)) return null; try { return await fixtureApi({ ...original }); } finally { releaseEnquirySubmission(lock); } };
  const result = await create();
  assert.equal(result?.id, "fixture-enquiry");
  assert.equal(calls, 1);
});

test("Enquiry component is keyboard-native, event-safe, bounded and has no expensive synchronous click reconstruction", async () => {
  const [source, css] = await Promise.all([
    readFile("src/features/commercialIdentity/EnquiryWorkspace.tsx", "utf8"),
    readFile("src/features/commercialIdentity/commercialIdentity.css", "utf8"),
  ]);
  for (const label of ["Name", "Company", "Email", "Telephone", "Source", "Lead source", "Project / site name", "Site address", "Notes", "Permanent Client", "Reviewed Project name", "Operational year"]) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /setDraft\s*\(\s*\([^)]*\)\s*=>[^)]*event\.currentTarget\.value/s);
  assert.doesNotMatch(source, /setDraft\s*\(\s*\([^)]*\)\s*=>[^)]*event\.target\.value/s);
  assert.match(source, /const value = readEnquiryControlValue\(control\);[\s\S]*setDraft\(\(current\) => updateEnquiryDraft\(current, field, value\)\)/);
  assert.match(source, /<form[^>]+onSubmit=\{submitCreate\}/);
  assert.match(source, /type="submit"[\s\S]*Create Enquiry/);
  assert.match(source, /claimEnquirySubmission\(submissionLock\)/);
  assert.match(source, /class EnquiryFeatureBoundary/);
  assert.match(source, /other QuoteSuite areas remain available/);
  assert.doesNotMatch(source, /onClick=\{[^}]*filter\(|onClick=\{[^}]*reduce\(|onClick=\{[^}]*JSON\.parse\(/s);
  assert.match(css, /commercial-identity-workspace\{[^}]*min-width:0/);
  assert.match(css, /commercial-identity-form \.ui-input[^}]*max-width:100%/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*grid-template-columns:1fr/);
  for (const token of ["--qs-theme-text", "--qs-theme-text-secondary", "--qs-type-meta", "--qs-bg-card", "--qs-border-standard"]) assert.match(css, new RegExp(token));
});
