import assert from "node:assert/strict";
import test from "node:test";
import { ROADMAP_CHRONOLOGY, ROADMAP_ITEMS } from "../src/features/developmentRoadmap/roadmap.data.ts";

test("implemented Email preview panes remain documented",()=>{
  const item=ROADMAP_ITEMS.find(entry=>entry.id==="communications"),text=(item?.notes||[]).join(" ");
  for(const phrase of ["List/full reader","Right preview","Bottom preview","one reader"])assert.match(text,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
});

test("live Email and manufacturer-document acceptance repair remains documented",()=>{
  const entry=ROADMAP_CHRONOLOGY.find(item=>item.title==="Live Email and technical-document interaction repair"),text=[entry?.objective,entry?.validation,...(entry?.limitations||[])].join(" ");
  for(const phrase of ["stale React event","preview selection","CID resources","manufacturer-document inputs","0 processes / 0 profiles","no email was sent"])assert.match(text,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
});
