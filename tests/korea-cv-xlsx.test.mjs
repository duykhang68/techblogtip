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

test('XLSX ZIP local entries contain all valid six worksheet parts and Unicode values',async()=>{
  const cv={targetCompany:'ABC',targetRole:'Kỹ sư',content:{personal:{koreanName:'홍길동',englishName:'TEST'},essays:{growth:'Tiếng Việt & 한국어'},education:[],employment:[],certifications:[],languages:[],projects:[],skills:[],awards:[],training:[],patents:[],referees:[],research:[]}};
  const bytes=new Uint8Array(await createKoreaCvXlsx(cv).arrayBuffer());
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder=new TextDecoder();let at=0;const entries=new Map();
  while(at+30<bytes.length && dv.getUint32(at,true)===0x04034b50){
    const length=dv.getUint32(at+18,true),nlen=dv.getUint16(at+26,true),extra=dv.getUint16(at+28,true);
    const name=decoder.decode(bytes.slice(at+30,at+30+nlen));
    const start=at+30+nlen+extra;
    entries.set(name,decoder.decode(bytes.slice(start,start+length)));
    at=start+length;
  }
  assert.equal(entries.size,11);
  for(let i=1;i<=6;i++)assert.match(entries.get('xl/worksheets/sheet'+i+'.xml')||'',/<worksheet /);
  assert.match(entries.get('xl/worksheets/sheet2.xml')||'',/Tiếng Việt &amp; 한국어/);
  assert.match(entries.get('xl/worksheets/sheet1.xml')||'',/Kỹ sư/);
  assert.match(entries.get('xl/workbook.xml')||'',/06_확인/);
});
