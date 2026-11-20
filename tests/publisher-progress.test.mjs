import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationProgress} from '../workers/publisher/src/publication-progress.mjs';
import {ADMIN_HTML,ADMIN_JS,ADMIN_CSS} from '../workers/publisher/src/ui.mjs';
import {EDITOR_HTML} from '../workers/publisher/src/editor-ui.mjs';

const id='TBT-12345678-1234-1234-1234-123456789012';
const url='https://github.com/duykhang68/techblogtip/pull/35';
const sha='a'.repeat(40);
const hash='f'.repeat(64);
const row=(change={})=>({
 sourceId:id,title:'Ví dụ bài mới',body:'Nội dung bài',
 status:'DRAFT',sourceHash:'',draftPr:'',
 publishedUrl:'',releaseSha:'',publishedAt:'',
 ...change,
});
const inspection=(change={})=>({
 sourceId:id,prUrl:url,headSha:sha,stage:'draft',productionVerified:false,
 ci:{checkedSha:sha,availability:'available',checks:[
  {name:'Astro · Types · Content · Build',status:'completed',conclusion:'success'}
 ]},...change
});
test('DRAFT and READY have visible pending stages, never a fabricated PR',()=>{
 const draft=publicationProgress(row());
 assert.equal(draft.complete,1);
 assert.equal(draft.phase,'draft');
 assert.equal(draft.steps.length,6);
 const ready=publicationProgress(row({status:'READY'}));
 assert.equal(ready.complete,2);
 assert.equal(ready.phase,'ready');
 assert.equal(ready.steps[2].done,false);
});
test('Draft PR stage requires K fingerprint and a trusted L URL',()=>{
 const valid=row({status:'READY',sourceHash:hash,draftPr:url});
 assert.equal(publicationProgress(valid).complete,3);
 assert.equal(publicationProgress(row({status:'READY',sourceHash:hash,draftPr:'https://evil.test/pr/35'})).complete,2);
 assert.equal(publicationProgress(row({status:'READY',sourceHash:'invalid',draftPr:url})).complete,2);
});
test('Draft PR never claims CI success without exact head SHA and all checks green',()=>{
 const r=row({status:'READY',sourceHash:hash,draftPr:url});
 const notChecked=publicationProgress(r);
 assert.equal(notChecked.complete,3);
 assert.equal(notChecked.steps[3].done,false);
 const mismatch=publicationProgress(r,inspection({ci:{...inspection().ci,checkedSha:'0'.repeat(40)}}));
 assert.equal(mismatch.complete,3);
 const partial=publicationProgress(r,inspection({ci:{...inspection().ci,availability:'partial'}}));
 assert.equal(partial.complete,3);
 const pending=publicationProgress(r,inspection({ci:{...inspection().ci,checks:[
  {name:'Astro · Types · Content · Build',status:'in_progress',conclusion:null}]}}));
 assert.equal(pending.complete,3);
 const passing=publicationProgress(r,inspection());
 assert.equal(passing.complete,4);
 assert.equal(passing.phase,'ci');
});
test('CI failure and closed test PR are not considered published',()=>{
 const r=row({status:'READY',sourceHash:hash,draftPr:url});
 const failed=publicationProgress(r,inspection({ci:{...inspection().ci,checks:[
  {name:'Astro · Types · Content · Build',status:'completed',conclusion:'failure'}
 ]}}));
 assert.equal(failed.phase,'failed');
 assert.equal(failed.productionVerified,false);
 const closed=publicationProgress(r,inspection({stage:'closed_unmerged'}));
 assert.equal(closed.phase,'closed');
 assert.equal(closed.productionVerified,false);
 assert.equal(closed.steps[4].done,false);
});
test('User-supplied PUBLISHED or M:O fields alone are not verified production',()=>{
 const r=row({status:'PUBLISHED',sourceHash:hash,draftPr:url,
  publishedUrl:'https://blog.example.test/bai-viet/test/',
  releaseSha:sha,publishedAt:'2026-11-21T01:00:00Z'});
 const unverified=publicationProgress(r,inspection({stage:'merged'}));
 assert.equal(unverified.productionVerified,false);
 assert.equal(unverified.complete,5);
 assert.equal(publicationProgress(r).steps[5].done,false);
 const verified=publicationProgress(r,inspection({stage:'merged',productionVerified:true}));
 assert.equal(verified.complete,6);
 assert.equal(verified.percent,100);
 assert.equal(verified.productionVerified,true);
});
test('Merged GitHub PR without Checks permission cannot falsely claim CI passed',()=>{
 const r=row({status:'READY',sourceHash:hash,draftPr:url});
 const status=publicationProgress(r,inspection({stage:'merged',
  ci:{checkedSha:sha,availability:'unavailable',checks:[]}}));
 assert.equal(status.steps[3].done,false);
 assert.equal(status.steps[4].done,true);
 assert.equal(status.productionVerified,false);
});
test('Trusted PR source identity required to show advanced status',()=>{
 const r=row({status:'READY',sourceHash:hash,draftPr:url});
 const other=publicationProgress(r,inspection({sourceId:'TBT-other-source'}));
 assert.equal(other.complete,3);
 assert.equal(other.checked,false);
});
test('Editor and article list include accessible, client-side progress display',()=>{
 assert.ok(EDITOR_HTML.includes('id="editor-publication-progress"'));
 assert.ok(ADMIN_JS.includes('const publicationProgress = function publicationProgress'));
 assert.ok(ADMIN_JS.includes('publication-progress'));
 assert.ok(ADMIN_JS.includes('Cập nhật tiến độ'));
 assert.ok(ADMIN_JS.includes('prChecks.set(row.sourceId'));
 assert.ok(ADMIN_CSS.includes('.progress-steps'));
 assert.doesNotThrow(()=>new Function(ADMIN_JS));
 assert.ok(ADMIN_HTML.includes('id="rows"'));
});
