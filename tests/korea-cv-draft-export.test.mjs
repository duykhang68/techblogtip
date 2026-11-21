import test from 'node:test';
import assert from 'node:assert/strict';
import {captureKoreaCvDraft} from '../src/lib/korea-cv-draft.mjs';
import {resolveKoreaCvExport} from '../src/lib/korea-cv-export-source.mjs';

const input=(name,value)=>({name,value});
function fixture(source='draft',selected=''){
 const formFields=[
   input('label','CV kỹ sư'),input('targetCompany','ABC'),
   input('targetRole','Kỹ sư'),input('locale','ko'),
   input('personal.koreanName','홍길동'),input('essays.motivation','Tôi muốn ứng tuyển tại ABC'),
 ];
 const row={dataset:{cvRowId:'original-row'},querySelectorAll:()=>[{dataset:{field:'school'},value:'Đại học thử nghiệm'}]};
 const rows={dataset:{rows:'education'},querySelectorAll:()=>[row]};
 return {
   querySelectorAll(selector){
    if(selector==='#input-panel [name]')return formFields;
    if(selector==='[data-rows]')return [rows];
    return [];
   },
   getElementById(id){
     if(id==='kcv-export-source')return {value:source};
     if(id==='kcv-select')return {value:selected};
     return null;
   },
 };
}
test('in-memory CV export includes all 12 arrays and unsaved edits',()=>{
 const cv=captureKoreaCvDraft(fixture());
 assert.equal(cv.label,'CV kỹ sư');
 assert.equal(cv.targetCompany,'ABC');
 assert.equal(cv.content.personal.koreanName,'홍길동');
 assert.equal(cv.content.essays.motivation,'Tôi muốn ứng tuyển tại ABC');
 assert.equal(cv.content.education[0].school,'Đại học thử nghiệm');
 assert.equal(cv.revision,0);
 for(const k of ['education','employment','certifications','languages','projects','skills','awards','training','patents','referees','research'])assert.ok(Array.isArray(cv.content[k]),k);
});
test('draft export does not require Google login or make network requests',async()=>{
 let called=false;
 const r=await resolveKoreaCvExport(fixture(),{connected:()=>false,driveRequest:()=>{called=true;throw Error('network called')},api:''});
 assert.equal(r.source,'draft');
 assert.equal(r.cv.targetCompany,'ABC');
 assert.equal(called,false);
});
test('saved export requires a selected record and authenticated Drive read',async()=>{
 const api='https://worker.example';
 let calls=0;
 await assert.rejects(resolveKoreaCvExport(fixture('saved',''),{connected:()=>true,driveRequest:()=>{},api}),/chọn một CV/);
 await assert.rejects(resolveKoreaCvExport(fixture('saved','abc'),{connected:()=>false,driveRequest:()=>{},api}),/kết nối Google/);
 const result=await resolveKoreaCvExport(fixture('saved','abc'),{
   connected:()=>true,driveRequest:async(url,path)=>{calls++;assert.equal(url,api);assert.equal(path,'/abc');return{cv:{label:'CV đã lưu',targetCompany:'XYZ'}};},api
 });
 assert.equal(calls,1);
 assert.equal(result.cv.targetCompany,'XYZ');
 assert.equal(result.source,'saved');
});
test('save does not mutate in-memory fields or force a Drive record to exist',()=>{
 const root=fixture();
 const first=captureKoreaCvDraft(root);
 const second=captureKoreaCvDraft(root,{id:first.id,revision:2,createdAt:first.createdAt});
 assert.equal(second.id,first.id);
 assert.equal(second.revision,2);
 assert.equal(second.createdAt,first.createdAt);
 assert.equal(second.targetCompany,'ABC');
});
