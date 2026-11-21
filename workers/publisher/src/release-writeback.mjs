import { fail, PublisherError } from './auth.mjs';
import { readSheet, putSystemCells, rowById } from './google-api.mjs';
import { inspectPublisherPR } from './pr-status.mjs';
import { verifyProductionEvidence, verifiedStoredRelease, productionOrigin, releaseShaStillValid } from './release-proof.mjs';
import { withSourceWriteLock } from './source-lock.mjs';
import { githubRequest } from './github-api.mjs';

const ID=/^TBT-[A-Za-z0-9-]{8,80}$/;
const SHA=/^[a-f0-9]{40}$/;
const STAMP=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

function recordedTriple(row){
  return row.cells.slice(12,15).map(x=>String(x||'').trim());
}

export async function finalizeVerifiedArticle(env,sourceId,fetcher=fetch,expectedReleaseSha=null){
  if(!ID.test(sourceId||''))fail(400,'source_invalid','System-issued source ID required');
  // Before any mutating request, confirm a dedicated production URL exists.
  productionOrigin(env);
  const initial=await readSheet(env,fetcher);
  const row=rowById(initial.records,sourceId);
  const pr=await inspectPublisherPR(env,row,sourceId,fetcher);
  const proof=await verifyProductionEvidence(env,row,pr,fetcher);
  if(expectedReleaseSha&&proof.sha!==expectedReleaseSha)
    fail(409,'release_callback_sha_mismatch','Current public release does not match confirmed deployment SHA');
  const before=recordedTriple(row);
  if(before.some(Boolean)){
    if(!before.every(Boolean)||before[0]!==proof.url||
       !await releaseShaStillValid(env,before[1],proof.sha,fetcher)||
       !STAMP.test(before[2])||!Number.isFinite(Date.parse(before[2]))||
       Date.parse(before[2])>Date.now()+300000)
      fail(409,'release_writeback_conflict','Existing release metadata is incomplete or differs; manual review required');
    return {sourceId,verified:true,created:false,publishedUrl:before[0],
      releaseSha:before[1],publishedAt:before[2],prUrl:pr.prUrl};
  }
  const latest=await readSheet(env,fetcher);
  const next=rowById(latest.records,sourceId);
  if(row.cells.slice(0,12).some((cell,i)=>next.cells[i]!==cell)||
      recordedTriple(next).some(Boolean))
    fail(409,'release_sheet_changed','Source or system release columns changed during production verification');
  const publishedAt=new Date().toISOString();
  await putSystemCells(env,latest.token,next.rowNumber,'M:O',
    [proof.url,proof.sha,publishedAt],fetcher);
  const confirmed=await readSheet(env,fetcher);
  const saved=rowById(confirmed.records,sourceId);
  if(saved.cells.slice(0,12).some((cell,i)=>cell!==row.cells[i])||
     saved.cells[12]!==proof.url||saved.cells[13]!==proof.sha||
     saved.cells[14]!==publishedAt)
    fail(409,'release_writeback_unconfirmed','Written release metadata could not be confirmed; inspect Sheet before retry');
  return {sourceId,verified:true,created:true,publishedUrl:proof.url,
    releaseSha:proof.sha,publishedAt,prUrl:pr.prUrl};
}

// Allows a signed, trusted deployment GitHub Action to trigger reconciliation.
// Auth is intentionally distinct from an editor's Google cookie.
export async function requireProductionSync(request,env,payload,fetcher=fetch){
  const secret=String(env.PRODUCTION_SYNC_TOKEN||'');
  if(secret.length<32||secret.length>256)
    fail(503,'release_sync_not_configured','Production event sync credential is not configured');
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>300)
    fail(401,'release_sync_denied','Production callback authentication required');
  const supplied=auth.slice(7);
  const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([hash(secret),hash(supplied)]);
  let different=0;
  for(let i=0;i<32;i++)different|=a[i]^b[i];
  if(different)fail(401,'release_sync_denied','Production callback authentication failed');
  if(!Number.isSafeInteger(payload?.runId)||payload.runId<1||payload.runId>1000000000000||
     !SHA.test(payload.releaseSha||'')||
     !Number.isInteger(payload.cursor)||payload.cursor<1||payload.cursor>200)
    fail(400,'release_sync_invalid','Expected trusted deploy runId, SHA and Sheet cursor');
  productionOrigin(env);
  const run=await githubRequest(env,'/actions/runs/'+payload.runId,{fetcher});
  // GitHub Actions `run-name` overrides the API's run.name with a dynamic SHA
  // label. Authorize by GitHub-controlled workflow path, repo, exact SHA and
  // run state instead; a mutable display name must never be an auth gate.
  if(run?.path!=='.github/workflows/deploy-production.yml'||
     !((run?.status==='in_progress'&&run?.conclusion==null)||
       (run?.status==='completed'&&run?.conclusion==='success'))||
     run?.head_branch!=='main'||run?.head_sha!==payload.releaseSha||
     run?.repository?.full_name!=='duykhang68/techblogtip'||
     !['push','workflow_dispatch'].includes(run?.event))
    fail(403,'release_sync_untrusted','The supplied workflow is not a successful main production deployment');
  return {runId:payload.runId,releaseSha:payload.releaseSha,cursor:payload.cursor};
}

// Event-driven, bounded batch scanning for merged READY sources (no cron).
// The workflow calls subsequent cursors until complete; every source uses its
// existing per-source Durable Object lock and rechecks public evidence.
export async function reconcileProductionBatch(env,{cursor=1,releaseSha},fetcher=fetch){
  productionOrigin(env);
  const sheet=await readSheet(env,fetcher);
  const remaining=sheet.records.filter(r=>r.rowNumber>cursor&&ID.test(r.cells[0])&&
    r.cells[10]&&r.cells[11]&&!recordedTriple(r).every(Boolean));
  const selected=remaining.slice(0,5);
  const results=[];
  for(const row of selected){
    const sourceId=row.cells[0];
    try{
      const result=await withSourceWriteLock(env,sourceId,()=>
        finalizeVerifiedArticle(env,sourceId,fetcher,releaseSha));
      results.push({sourceId,state:'written',created:result.created});
    }catch(error){
      results.push({sourceId,state:'pending',code:error instanceof PublisherError?error.code:'verification_unavailable'});
    }
  }
  const nextCursor=selected.length?selected[selected.length-1].rowNumber:cursor;
  return {processed:results.length,results,nextCursor,hasMore:remaining.length>selected.length};
}
