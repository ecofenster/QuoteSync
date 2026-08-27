import assert from "node:assert/strict";
import test from "node:test";
import { ROADMAP_ITEMS } from "../src/features/developmentRoadmap/roadmap.data.ts";

test("implemented Email preview panes remain documented",()=>{
  const item=ROADMAP_ITEMS.find(entry=>entry.id==="communications"),text=(item?.notes||[]).join(" ");
  for(const phrase of ["List/full reader","Right preview","Bottom preview","one reader"])assert.match(text,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
});
