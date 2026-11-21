import test from 'node:test';import assert from 'node:assert/strict';
import {savedCvSummary} from '../src/lib/korea-cv-preview.mjs';
test('Saved tab displays only persisted CV and never supplies sample Samsung data',()=>{
 const summary=savedCvSummary({schemaVersion:1,id:'example',revision:2,targetCompany:'ABC',targetRole:'Designer',
 content:{personal:{koreanName:'민수'},essays:{growth:'Quá trình trưởng thành'},education:[{id:'school',school:'ABC'}],projects:[],employment:[],certifications:[],languages:[],skills:[],awards:[],training:[],patents:[],referees:[],research:[]}});
 assert.equal(summary.revision,2);assert.equal(summary.fields[0][1],'ABC');assert.ok(summary.essays.some(e=>e[1]==='Quá trình trưởng thành'));
 assert.equal(summary.sections[0].items.length,1);assert.doesNotMatch(JSON.stringify(summary),/Samsung|Egina|Shell/);
});
test('Saved tab refuses invalid remote records',()=>assert.throws(()=>savedCvSummary({content:{}}),/Invalid saved CV/));
