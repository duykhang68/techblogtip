import {githubRequest} from './github-api.mjs';
import {readSheet} from './google-api.mjs';

const VALID_STATES=['IDEA','DRAFT','REVIEW','READY','PUBLISHED'];
const allowedWorkflowNames=new Set(['Quality','Deploy · GitHub Pages production','Deploy · TechBlogTip Publisher DEV (manual)']);

function snapshotFailure(error){
 return {available:false,status:'unavailable',reason:error?.code==='sheet_not_configured'?'not_configured':'source_unavailable'};
}

// Authenticated, on-demand operational snapshot. No timer, cron, cached secrets,
// public telemetry endpoint, or client GitHub API. Individual sources fail closed.
export async function readEditorialOperations(env,fetcher=fetch){
 const [sheetResult,runsResult]=await Promise.allSettled([
  readSheet(env,fetcher),
  githubRequest(env,'/actions/runs?per_page=50&exclude_pull_requests=false',{fetcher}),
 ]);
 const sheet=sheetResult.status==='fulfilled'?(()=>{
  const records=sheetResult.value.records;
  if(!Array.isArray(records))return {available:false,status:'invalid'};
  const states=Object.fromEntries(VALID_STATES.map(x=>[x,0]));
  let submitted=0,publishedProof=0,needsReview=0;
  for(const row of records){
   const cells=row?.cells;
   if(!Array.isArray(cells)||!cells[0])continue;
   const stage=String(cells[8]||'').trim().toUpperCase();
   if(VALID_STATES.includes(stage))states[stage]++;
   const pr=String(cells[11]||'');
   const url=String(cells[12]||'');
   const release=String(cells[13]||'');
   if(/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/\d+$/.test(pr))submitted++;
   if(/^https:\/\/duykhang68\.github\.io\/techblogtip\/bai-viet\//.test(url)&&/^[a-f0-9]{40}$/.test(release)&&cells[14])publishedProof++;
   if(stage==='READY'&&!pr)needsReview++;
  }
  return {available:true,states,total:Object.values(states).reduce((a,b)=>a+b,0),submitted,publishedProof,needsReview,
   note:'Counts reflect Sheets metadata only; release verification requires independent public proof'};
 })():snapshotFailure(sheetResult.reason);
 const workflows=runsResult.status==='fulfilled'?(()=>{
  const runs=runsResult.value?.workflow_runs;
  if(!Array.isArray(runs))return {available:false,status:'invalid'};
  const selected=runs.filter(run=>allowedWorkflowNames.has(run.name)).slice(0,30);
  const totals={success:0,failure:0,in_progress:0,other:0};
  const items=selected.slice(0,8).map(run=>{
   const id=Number(run.id),result=String(run.conclusion||''),status=String(run.status||'');
   if(status!=='completed')totals.in_progress++;
   else if(result==='success')totals.success++;
   else if(['failure','timed_out','action_required'].includes(result))totals.failure++;
   else totals.other++;
   return {id:Number.isSafeInteger(id)?id:null,name:run.name,
    status:status.slice(0,30),conclusion:result.slice(0,30),
    sha:/^[a-f0-9]{40}$/.test(run.head_sha||'')?run.head_sha:null,
    url:Number.isSafeInteger(id)?'https://github.com/duykhang68/techblogtip/actions/runs/'+id:null};
  });
  for(const run of selected.slice(8)){
   if(run.status!=='completed')totals.in_progress++;
   else if(run.conclusion==='success')totals.success++;
   else if(['failure','timed_out','action_required'].includes(run.conclusion))totals.failure++;
   else totals.other++;
  }
  return {available:true,limited:runs.length>=50,sampled:selected.length,totals,items,
   note:'Recent workflow sample, not full-history or CI pass rate'};
 })():snapshotFailure(runsResult.reason);
 return {snapshotAt:new Date().toISOString(),source:'authenticated-on-demand',sheet,workflows};
}
