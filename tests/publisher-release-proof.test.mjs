import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, generateKeyPairSync } from 'node:crypto';
import { normalizeSheetRow } from '../scripts/publisher/sheets.mjs';
import { branchFor } from '../workers/publisher/src/github-api.mjs';
import { productionOrigin,verifyProductionEvidence,verifiedStoredRelease } from '../workers/publisher/src/release-proof.mjs';
import { finalizeVerifiedArticle,reconcileProductionBatch,requireProductionSync } from '../workers/publisher/src/release-writeback.mjs';

globalThis.crypto ??= webcrypto;
const sourceId='TBT-12345678-1234-1234-1234-123456789012';
const site='https://blog.example.test';
const mainSha='a'.repeat(40),mergeSha='b'.repeat(40);
const spreadsheetId='spreadsheet-test-p5c3-abcdefgh';
const sheetGid='142694714';
const columns=[
 'source_id','title','body','author','category','tags','summary','series','status','slug',
 'source_hash','draft_pr','published_url','release_sha','published_at'
];
const keys=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({
 type:'pkcs8',format:'pem'
});
const env0={
 SHEETS_SPREADSHEET_ID:spreadsheetId,SHEETS_GID:sheetGid,
 GITHUB_PUBLISHER_TOKEN:'test-api-token',
 GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({
  type:'service_account',client_email:'test@fake.gserviceaccount.com',private_key:keys,
 }),
 PRODUCTION_SITE_URL:site,
 PRODUCTION_SYNC_TOKEN:'x'.repeat(48),
};
async function fixture(){
 const cells=[
  sourceId,'Kiểm tra bài đăng production bằng SHA',
  ('## Mục tiêu\nBài thử nghiệm kiểm tra bằng chứng xuất bản thực tế, không dựa vào trạng thái trên Sheet. ').repeat(2),
  'TechBlogTip','Kiểm thử hệ thống','Sheets, Cloudflare',
  'Mô tả kiểm thử release thực tế bằng source hash, SHA commit và URL công khai.',
  '','READY','kiem-tra-production-sha','','https://github.com/duykhang68/techblogtip/pull/35','','','',
 ];
 const normalized=normalizeSheetRow(cells,{
  spreadsheetId,sheetGid,publishedDate:'2000-01-01',
 });
 cells[10]=normalized.fingerprint;
 const env={...env0};
 const branch=await branchFor({source:{spreadsheetId,sheetGid},sourceId});
 const pr={
  number:35,html_url:cells[11],state:'closed',draft:false,
  merged_at:'2026-11-20T23:52:00Z',merge_commit_sha:mergeSha,
  base:{ref:'main'},head:{sha:'c'.repeat(40),ref:branch,
   repo:{full_name:'duykhang68/techblogtip'}},
  body:'source-id: '+sourceId+'\nsource-revision: '+cells[10],
 };
 const runtime={
  cells,env,pr,marker:{project:'techblogtip',ref:'main',sha:mainSha,
    builtAt:'2026-11-21T00:10:00.000Z'},
  html:'',status:200,compare:'ahead',writes:[],requests:[],
 };
 runtime.html='<html><head><meta name="robots" content="index,follow">'+
  '<link rel="canonical" href="'+site+'/bai-viet/'+normalized.slug+'/"></head>'+
  '<body><article id="article-body" data-publisher-source-id="'+sourceId+
  '" data-publisher-source-revision="'+normalized.fingerprint+'">Article</article></body></html>';
 env.SOURCE_LOCKS={
  getByName:()=>({acquire:async()=>true,release:async()=>true}),
 };
 const fetcher=async(input,options={})=>{
  const url=new URL(String(input)),method=options.method||'GET';
  runtime.requests.push({url:url.href,method});
  if(url.hostname==='oauth2.googleapis.com')
    return Response.json({access_token:'test-token',token_type:'Bearer'});
  if(url.hostname==='sheets.googleapis.com'){
    if(url.searchParams.has('fields'))
      return Response.json({sheets:[{properties:{sheetId:Number(sheetGid),title:'VN'}}]});
    if(method==='GET'&&url.pathname.includes('/values/'))
      return Response.json({values:[columns,[...cells]]});
    if(method==='PUT'){
      const range=decodeURIComponent(url.pathname.split('/values/')[1]);
      const data=JSON.parse(options.body);
      runtime.writes.push({range,values:data.values[0]});
      if(range==='VN!M2:O2')cells.splice(12,3,...data.values[0]);
      else return Response.json({error:'unexpected sheet write'},{status:403});
      return Response.json({updatedRange:range});
    }
  }
  if(url.hostname==='api.github.com'){
    const path=url.pathname.replace('/repos/duykhang68/techblogtip','');
    if(path==='/pulls/35')return Response.json(pr);
    if(path.includes('/check-runs'))
      return Response.json({total_count:1,check_runs:[
        {name:'Astro · Types · Content · Build',status:'completed',conclusion:'success'}
      ]});
    if(path.startsWith('/compare/'))return Response.json({status:runtime.compare});
    if(path==='/git/ref/heads/main')return Response.json({object:{sha:mainSha}});
    if(path==='/actions/runs/123')
      return Response.json({name:'Deploy · GitHub Pages production',
        path:'.github/workflows/deploy-production.yml',status:'completed',
        conclusion:'success',head_branch:'main',head_sha:mainSha,
        repository:{full_name:'duykhang68/techblogtip'},event:'workflow_dispatch'});
    return Response.json({message:'not found'},{status:404});
  }
  if(url.origin===site){
    if(url.pathname==='/release.json')return Response.json(runtime.marker,{status:runtime.status});
    if(url.pathname.startsWith('/bai-viet/'))
      return new Response(runtime.html,{status:runtime.status,
        headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  throw Error('Unexpected URL '+url.href);
 };
 const snapshot={
  sourceId,prUrl:cells[11],stage:'merged',headSha:pr.head.sha,
  mergeSha,ci:{availability:'available',checkedSha:pr.head.sha,checks:[
   {name:'Astro · Types · Content · Build',status:'completed',conclusion:'success'}
  ]},
 };
 return {runtime,fetcher,env,row:{cells,rowNumber:2},snapshot,normalized};
}
test('production rejects absent staging/dev URLs instead of treating them as public blog',()=>{
 assert.equal(productionOrigin({...env0,PRODUCTION_SITE_URL:''}),'https://duykhang68.github.io/techblogtip');
 assert.equal(productionOrigin({...env0,PRODUCTION_SITE_URL:'https://duykhang68.github.io/techblogtip/'}),'https://duykhang68.github.io/techblogtip');
 for(const u of ['https://techblogtip-staging.tamsudev-com.workers.dev',
  'http://blog.example.test','https://blog.example.test:8443','https://localhost/',
  'https://duykhang68.github.io/', 'https://other.github.io/techblogtip/'])
  assert.throws(()=>productionOrigin({...env0,PRODUCTION_SITE_URL:u}),{code:'production_config_invalid'});
});
test('verified live release checks source proof, canonical, indexable HTML and commit ancestry',async()=>{
 const f=await fixture();
 const proof=await verifyProductionEvidence(f.env,f.row,f.snapshot,f.fetcher);
 assert.equal(proof.url,site+'/bai-viet/kiem-tra-production-sha/');
 assert.equal(proof.sha,mainSha);
 assert.equal(f.runtime.writes.length,0);
});
test('blocked release cannot write if PR not merged, article invalid, stale source or nonancestor SHA',async()=>{
 const f=await fixture();
 await assert.rejects(verifyProductionEvidence(f.env,f.row,
  {...f.snapshot,stage:'closed_unmerged'},f.fetcher),{code:'release_pr_not_merged'});
 f.runtime.html=f.runtime.html.replace('data-publisher-source-revision','data-invalid-revision');
 await assert.rejects(verifyProductionEvidence(f.env,f.row,f.snapshot,f.fetcher),{code:'article_proof_mismatch'});
 f.runtime.html=f.runtime.html.replace('data-invalid-revision','data-publisher-source-revision');
 f.runtime.compare='diverged';
 await assert.rejects(verifyProductionEvidence(f.env,f.row,f.snapshot,f.fetcher),{code:'release_not_after_merge'});
 f.runtime.compare='ahead';
 f.runtime.cells[2]+='changed after submission';
 await assert.rejects(verifyProductionEvidence(f.env,f.row,f.snapshot,f.fetcher),{code:'release_revision_changed'});
 assert.equal(f.runtime.writes.length,0);
});
test('writes exactly M:O after live proof, re-reads, and repeats idempotently',async()=>{
 const f=await fixture();
 const first=await finalizeVerifiedArticle(f.env,sourceId,f.fetcher);
 assert.equal(first.created,true);
 assert.equal(first.releaseSha,mainSha);
 assert.equal(f.runtime.writes.length,1);
 assert.equal(f.runtime.writes[0].range,'VN!M2:O2');
 assert.equal(await verifiedStoredRelease(f.env,f.row,f.snapshot,f.fetcher),true);
 const again=await finalizeVerifiedArticle(f.env,sourceId,f.fetcher);
 assert.equal(again.created,false);
 assert.equal(f.runtime.writes.length,1);
});
test('published article remains verified after a later Pages release without rewriting M:O',async()=>{
 const f=await fixture();
 const published=await finalizeVerifiedArticle(f.env,sourceId,f.fetcher);
 const oldSha=published.releaseSha;
 const oldStamp=published.publishedAt;
 const newSha='e'.repeat(40);
 f.runtime.marker.sha=newSha;
 assert.equal(await verifiedStoredRelease(f.env,f.row,f.snapshot,f.fetcher),true);
 const checked=await finalizeVerifiedArticle(f.env,sourceId,f.fetcher);
 assert.equal(checked.created,false);
 assert.equal(checked.releaseSha,oldSha);
 assert.equal(checked.publishedAt,oldStamp);
 assert.equal(f.runtime.writes.length,1);
});
test('never writes stale, unavailable or incorrect production SHA; no manual overwrite',async()=>{
 const f=await fixture();
 f.runtime.marker.sha='d'.repeat(40);
 await assert.rejects(finalizeVerifiedArticle(f.env,sourceId,f.fetcher,mainSha),
  {code:'release_callback_sha_mismatch'});
 assert.equal(f.runtime.writes.length,0);
 f.runtime.marker.sha=mainSha;
 f.runtime.cells[12]='https://evil.test/article';
 await assert.rejects(finalizeVerifiedArticle(f.env,sourceId,f.fetcher),
  {code:'release_writeback_conflict'});
 assert.equal(f.runtime.writes.length,0);
});
test('event-driven sync verifies a trusted workflow run and writes bounded batch',async()=>{
 const f=await fixture();
 const request=new Request('https://publisher.example.test/api/reconcile-production',{
  method:'POST',headers:{Authorization:'Bearer '+f.env.PRODUCTION_SYNC_TOKEN}
 });
 const valid=await requireProductionSync(request,f.env,{
  runId:123,releaseSha:mainSha,cursor:1,
 },f.fetcher);
 assert.equal(valid.releaseSha,mainSha);
 const batch=await reconcileProductionBatch(f.env,valid,f.fetcher);
 assert.equal(batch.processed,1);
 assert.equal(batch.results[0].state,'written');
 assert.equal(batch.hasMore,false);
 assert.equal(f.runtime.writes.length,1);
 await assert.rejects(requireProductionSync(new Request(request.url,{
  method:'POST',headers:{Authorization:'Bearer invalid'}
 }),f.env,{runId:123,releaseSha:mainSha,cursor:1},f.fetcher),{code:'release_sync_denied'});
});

test('production run-name preserves trusted callback identity on main',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
 const mainTitle=workflow.split('run-name: >-')[1]?.split('\non:')[0]||'';
 assert.match(mainTitle,/github\.ref == 'refs\/heads\/main'/);
 assert.match(mainTitle,/&& 'Deploy · GitHub Pages production'/);
 assert.match(mainTitle,/SKIP · production requires main/);
});
