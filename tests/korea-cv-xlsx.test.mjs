import test from 'node:test';import assert from 'node:assert/strict';
import {koreaCvSheets,createKoreaCvXlsx} from '../src/lib/korea-cv-xlsx.mjs';
test('XLSX is a ZIP archive with six Unicode worksheets and never adds sample Samsung data',async()=>{
 const cv={targetCompany:'ABC',targetRole:'개발자',content:{personal:{koreanName:'김 철수',englishName:'Candidate'},
  essays:{growth:'Thành tích thực tế'},education:[],employment:[],certifications:[],languages:[],projects:[],skills:[],awards:[],training:[],patents:[],referees:[],research:[]}};
 const sheets=koreaCvSheets(cv);assert.equal(sheets.length,6);assert.equal(sheets[0].rows[2][1],'개발자');
 const blob=createKoreaCvXlsx(cv);
 assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const binary=new Uint8Array(await blob.arrayBuffer());
 assert.deepEqual([...binary.slice(0,4)],[80,75,3,4]);
 assert.ok(binary.length>2000);
 assert.doesNotMatch(sheets.map(s=>JSON.stringify(s.rows)).join(''),/Samsung|Egina FPSO/i);
});
