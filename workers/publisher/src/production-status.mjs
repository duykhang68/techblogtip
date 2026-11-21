import {githubRequest} from './github-api.mjs';
import {productionOrigin} from './release-proof.mjs';

const SHA=/^[a-f0-9]{40}$/;
const STAGING='https://techblogtip-staging.tamsudev-com.workers.dev';
const PUBLISHER='https://techblogtip-publisher-dev.tamsudev-com.workers.dev';

function resultOf(settled,fn){
  if(settled.status!=='fulfilled')return {available:false,status:'unavailable'};
  try{return fn(settled.value);}catch{return {available:false,status:'invalid'};}
}

function runSummary(run){
  if(!Number.isSafeInteger(run?.id)||run.id<1||
    !/^https:\/\/github\.com\/duykhang68\/techblogtip\/actions\/runs\/\d+$/.test(run.html_url||''))
    return null;
  return {
    id:run.id,name:String(run.name||'GitHub Actions').slice(0,90),
    status:['queued','in_progress','completed','waiting','requested','pending'].includes(run.status)?run.status:'unknown',
    conclusion:typeof run.conclusion==='string'?run.conclusion.slice(0,32):null,
    sha:SHA.test(run.head_sha||'')?run.head_sha:null,
    event:String(run.event||'').slice(0,40),
    updatedAt:String(run.updated_at||'').slice(0,50),
    url:run.html_url,
  };
}

// The repository is public. Fine-grained Publisher tokens may intentionally lack
// Actions:Read, so fall back to its public GitHub Actions endpoint server-side.
// Still GET-only, bounded, manual and never exposed to the browser.
async function publicActionsRuns(fetcher){
  const url='https://api.github.com/repos/duykhang68/techblogtip/actions/runs?per_page=30';
  const response=await fetcher(url,{
    method:'GET',
    headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'techblogtip-production-status'},
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw Error('public_github_actions_unavailable');
  return response.json();
}

async function fetchPublicJson(url,fetcher){
  const response=await fetcher(url,{
    method:'GET',headers:{Accept:'application/json','Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw new Error('public_release_unavailable');
  const payload=await response.json();
  if(!payload||typeof payload!=='object')throw new Error('public_release_invalid');
  return payload;
}

// Invoked only by an authenticated editor using the Publisher Worker.
// One bounded snapshot per manual request. Never writes and never marks
// a production environment verified based on GitHub or staging alone.
export async function readProductionStatus(env,fetcher=fetch){
  const get=path=>githubRequest(env,path,{fetcher});
  let productionBase=null;
  try{productionBase=productionOrigin(env);}catch{ /* not configured; do not use staging */ }
  const [mainResult,prsResult,runsResult,stagingResult,publisherResult,productionResult]=await Promise.allSettled([
    get('/git/ref/heads/main'),
    get('/pulls?state=open&per_page=100&sort=created&direction=asc'),
    get('/actions/runs?per_page=30').catch(()=>publicActionsRuns(fetcher)),
    fetchPublicJson(STAGING+'/release.json',fetcher),
    fetchPublicJson(PUBLISHER+'/health',fetcher),
    productionBase?fetchPublicJson(productionBase+'/release.json',fetcher):Promise.reject(new Error('not_configured')),
  ]);
  const main=resultOf(mainResult,v=>{
    if(!SHA.test(v?.object?.sha||''))throw Error('main_sha_invalid');
    return {available:true,sha:v.object.sha};
  });
  const queue=resultOf(prsResult,v=>{
    if(!Array.isArray(v))throw Error('pulls_invalid');
    return {available:true,count:v.length,limited:v.length===100,items:v.slice(0,20).map(p=>({
      number:p.number,draft:p.draft===true,
      title:String(p.title||'Pull request').slice(0,130),
      sha:SHA.test(p.head?.sha||'')?p.head.sha:null,
      url:Number.isSafeInteger(p.number)?'https://github.com/duykhang68/techblogtip/pull/'+p.number:null,
    })).filter(p=>p.url)};
  });
  const actions=resultOf(runsResult,v=>{
    if(!Array.isArray(v?.workflow_runs))throw Error('actions_invalid');
    const runs=v.workflow_runs.map(runSummary).filter(Boolean);
    return {available:true,items:runs.slice(0,12),
      // A run conclusion is not proof of a deployed public release.
      note:'GitHub Actions là thông tin CI/CD, không chứng nhận production'};
  });
  const staging=resultOf(stagingResult,v=>{
    if(v.project!=='techblogtip'||!SHA.test(v.sha||''))throw Error('staging_marker_invalid');
    return {available:true,sha:v.sha,ref:String(v.ref||'').slice(0,60),
      builtAt:String(v.builtAt||'').slice(0,50),
      matchesMain:main.available?v.sha===main.sha:null,
      verifiedMarker:true,environment:'staging'};
  });
  const publisherDev=resultOf(publisherResult,v=>{
    if(v.app!=='techblogtip-publisher'||!SHA.test(v.releaseSha||''))
      throw Error('publisher_marker_invalid');
    return {available:true,sha:v.releaseSha,
      matchesMain:main.available?v.releaseSha===main.sha:null,
      sourceWriteLocks:v.sourceWriteLocks===true,environment:'publisher-dev'};
  });
  const production=resultOf(productionResult,v=>{
    if(v.project!=='techblogtip'||v.ref!=='main'||!SHA.test(v.sha||''))
      throw Error('production_marker_invalid');
    return {configured:true,verified:true,status:'release_marker_verified',
      releaseSha:v.sha,base:productionBase,
      matchesMain:main.available?v.sha===main.sha:null,
      note:'Production release marker found; individual article publication is verified separately'};
  });
  if(!productionBase){
    production.configured=false;production.verified=false;production.status='not_configured';
    production.note='No dedicated production domain; staging and Publisher DEV do not count';
  }else if(!production.available){
    production.configured=true;production.verified=false;production.status='not_verified';
    production.note='Dedicated production URL configured but public release not verified';
  }
  return {
    snapshotAt:new Date().toISOString(),repo:'duykhang68/techblogtip',
    main,queue,actions,staging,publisherDev,production,
  };
}
