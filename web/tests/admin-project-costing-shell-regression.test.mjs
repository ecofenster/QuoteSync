import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("the actual Admin Feature Controls render path contains no Project Costing preview shell",async()=>{const[parent,host]=await Promise.all([readFile("src/features/admin/AdminPlaceholderPage.tsx","utf8"),readFile("src/features/admin/AdminSupplierQuoteImportBeta.tsx","utf8")]);assert.match(parent,/activeSection === "feature_controls"[\s\S]*<AdminSupplierQuoteImportBeta/);assert.match(host,/return selected\?<EstimateCommercialWorkspace/);for(const text of ["Supplier Quotations &amp; Project Costing (Preview)","Temporary development entry","Create disposable development estimate"])assert.doesNotMatch(host,new RegExp(text));assert.doesNotMatch(host,/<section className="admin-card admin-card--content ui-card">/);});

test("development fixture creation remains callable but is not rendered",async()=>{const host=await readFile("src/features/admin/AdminSupplierQuoteImportBeta.tsx","utf8");assert.match(host,/export async function createDisposablePreviewEstimate/);assert.match(host,/dev-commercial-preview-client/);assert.doesNotMatch(host,/>Create disposable development estimate</)});
