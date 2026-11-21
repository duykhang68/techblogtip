import { fail } from './auth.mjs';
import { githubRequest } from './github-api.mjs';
import { normalizeSheetRow } from '../../../scripts/publisher/sheets.mjs';

const SHA=/^[a-f0-9]{40}$/;
const REV=/^[a-f0-9]{64}$/;
const PR_LINK=/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/[1-9][0-9]*$/;
const VERIFIED_CHECK='Astro · Types · Content · Build';

export const GITHUB_PAGES_PRODUCTION='https://duykhang68.github.io/techblogtip/';

// A project Pages site has a fixed, dedicated subpath. Never drop /techblogtip/
// when constructing release and article URLs, and never trust arbitrary github.io.
export function productionOrigin(env){
  const raw=String(env.PRODUCTION_SITE_URL||GITHUB_PAGES_PRODUCTION).trim();
  let url;
  try{url=new URL(raw);}catch{fail(503,'production_config_invalid','Production URL is invalid');}
  const host=url.hostname.toLowerCase();
  const isProjectPages=host==='duykhang68.github.io'&&url.pathname==='/techblogtip/';
  const customRoot=url.pathname==='/'&&!host.endsWith('.github.io');
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||
     !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)||
     !(isProjectPages||customRoot)||
     host.endsWith('.workers.dev')||host.endsWith('.pages.dev')||
     host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
     host.endsWith('.example')||host.endsWith('.internal')||
     /^(\d+\.){3}\d+$/.test(host))
    fail(503,'production_config_invalid','Production must use the approved GitHub Pages project path or an explicitly approved root domain');
  return isProjectPages?url.origin+'/techblogtip':url.origin;
}

function prepareRow(env,row,sourceId){
  if(row?.cells?.[0]?.trim()!==sourceId)
    fail(409,'source_conflict','Source identity changed');
  const cells=row.cells;
  const state=cells[8].trim().toUpperCase();
  if(!['READY','PUBLISHED'].includes(state))
    fail(409,'release_not_approved','Article must have editorial READY approval');
  if(!REV.test(cells[10])||!PR_LINK.test(cells[11]))
    fail(409,'release_not_submitted','Authorized PR and source fingerprint are required');
  let article;
  try{
    article=normalizeSheetRow([...cells.slice(0,8),'READY',...cells.slice(9)],{
      spreadsheetId:env.SHEETS_SPREADSHEET_ID,
      sheetGid:env.SHEETS_GID,publishedDate:'2000-01-01',
    });
  }catch{
    fail(409,'release_source_invalid','Current editorial content is not valid for the submitted source');
  }
  if(article.fingerprint!==cells[10])
    fail(409,'release_revision_changed','Google Sheet content changed after Draft PR creation');
  return article;
}
function checkPR(pr,row){
  const ci=pr?.ci;
  if(pr?.stage!=='merged'||!SHA.test(pr?.mergeSha||'')||!SHA.test(pr?.headSha||'')||
     pr?.prUrl!==row.cells[11])
    fail(409,'release_pr_not_merged','Matching source PR must be merged to main');
  if(ci?.availability!=='available'||ci.checkedSha!==pr.headSha||
     !Array.isArray(ci.checks)||!ci.checks.length||
     !ci.checks.some(c=>c.name===VERIFIED_CHECK)||
     ci.checks.some(c=>c.status!=='completed'||c.conclusion!=='success'))
    fail(409,'release_ci_unverified','Exact PR head CI checks are not all verified successful');
}
async function getPublic(url,contentType,fetcher,maxBytes=600000){
  let response;
  try{
    response=await fetcher(url,{method:'GET',redirect:'manual',
      headers:{Accept:contentType==='json'?'application/json':'text/html','Cache-Control':'no-cache'},
      signal:AbortSignal.timeout(12000)});
  }catch{fail(502,'public_fetch_failed','Cannot fetch production release evidence');}
  if(response.status!==200)fail(409,'public_not_available','Public release or article is not available (HTTP '+response.status+')');
  const kind=response.headers.get('content-type')||'';
  if(contentType==='json'&&!kind.includes('json'))fail(409,'public_content_type','Production release marker is not JSON');
  if(contentType==='html'&&!kind.includes('html'))fail(409,'public_content_type','Published article is not HTML');
  if(Number(response.headers.get('content-length')||0)>maxBytes)fail(413,'public_too_large','Public release evidence is too large');
  const text=await response.text();
  if(text.length>maxBytes)fail(413,'public_too_large','Public release evidence is too large');
  return text;
}
async function evidence(env,row,pr,fetcher){
  const base=productionOrigin(env);
  const article=prepareRow(env,row,row.cells[0]);
  checkPR(pr,row);
  const url=base+'/bai-viet/'+article.slug+'/';
  const marker=JSON.parse(await getPublic(base+'/release.json','json',fetcher,5000));
  if(marker?.project!=='techblogtip'||marker?.ref!=='main'||!SHA.test(marker?.sha||'')||
     !Number.isFinite(Date.parse(marker?.builtAt||'')))
    fail(409,'release_marker_invalid','Production release marker is not a verified main build');
  const html=await getPublic(url,'html',fetcher);
  if(!html.includes('data-publisher-source-id="'+article.sourceId+'"')||
     !html.includes('data-publisher-source-revision="'+article.fingerprint+'"')||
     !html.includes('rel="canonical" href="'+url+'"')||
     !/<meta\s+name="robots"\s+content="index,follow"/.test(html))
    fail(409,'article_proof_mismatch','Public article source, canonical URL, or indexability does not match');
  const [history,main]=await Promise.all([
    githubRequest(env,'/compare/'+pr.mergeSha+'...'+marker.sha,{fetcher}),
    githubRequest(env,'/git/ref/heads/main',{fetcher}),
  ]);
  if(!['ahead','identical'].includes(history?.status))
    fail(409,'release_not_after_merge','Public SHA does not include the article merge commit');
  if(!SHA.test(main?.object?.sha||''))
    fail(502,'release_main_unknown','Cannot validate GitHub main');
  const ancestry=await githubRequest(env,'/compare/'+marker.sha+'...'+main.object.sha,{fetcher});
  if(!['ahead','identical'].includes(ancestry?.status))
    fail(409,'release_not_on_main','Public release SHA is not in main history');
  return {url,sha:marker.sha,sourceId:article.sourceId,sourceRevision:article.fingerprint};
}

export async function verifyProductionEvidence(env,row,pr,fetcher=fetch){
  return evidence(env,row,pr,fetcher);
}

// Full proof is revalidated, including public marker and article, on each
// on-demand inspection. A previously stored M:O triple alone means nothing.
export async function verifiedStoredRelease(env,row,pr,fetcher=fetch){
  const [url,sha,time]=row.cells.slice(12,15).map(s=>s.trim());
  if(!url||!SHA.test(sha)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time)||
     !Number.isFinite(Date.parse(time))||Date.parse(time)>Date.now()+300000)
    return false;
  try{
    const result=await evidence(env,row,pr,fetcher);
    return result.url===url&&result.sha===sha;
  }catch{return false;}
}
