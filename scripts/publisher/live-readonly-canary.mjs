// Trusted main only. Verify live publisher wiring without changing Sheets or GitHub.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readSheet } from '../../workers/publisher/src/google-api.mjs';
import { branchFor, githubRequest } from '../../workers/publisher/src/github-api.mjs';
import { normalizeSheetRow } from './sheets.mjs';

const DEV_URL='https://techblogtip-publisher-dev.tamsudev-com.workers.dev';
const HEX=/^[a-f0-9]{40}$/;

// Verify a real submitted article against the pinned Sheet and GitHub PR.
// This path is strictly read-only, requires an explicit source ID, and never
// outputs source text, credentials, or service-account material.
export async function auditPublisherSubmission(records,runtime,sourceId,githubRead){
  if(typeof sourceId!=='string'||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
    throw new Error('e2e_source_id_invalid');
  const matching=records.filter(row=>row.cells[0].trim()===sourceId);
  if(matching.length!==1)throw new Error('e2e_source_missing_or_duplicated');
  const cells=matching[0].cells;
  if(cells[8].trim().toUpperCase()!=='READY')throw new Error('e2e_source_not_ready');
  // The publication date is deliberately irrelevant to sourceRevision.
  // It is excluded by normalizeSheetRow's stable identity/content fingerprint.
  const prepared=normalizeSheetRow(cells,{
    spreadsheetId:runtime.SHEETS_SPREADSHEET_ID,
    sheetGid:runtime.SHEETS_GID,
    publishedDate:'2000-01-01',
  });
  if(!/^[a-f0-9]{64}$/.test(cells[10])||cells[10]!==prepared.fingerprint)
    throw new Error('e2e_sheet_revision_mismatch');
  if(cells.slice(12,15).some(value=>value.trim()))
    throw new Error('e2e_release_fields_must_be_blank');
  const match=/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/([1-9][0-9]*)$/.exec(cells[11].trim());
  if(!match)throw new Error('e2e_pr_url_invalid');
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number))throw new Error('e2e_pr_number_invalid');
  const branch=await branchFor({source:{spreadsheetId:runtime.SHEETS_SPREADSHEET_ID,sheetGid:runtime.SHEETS_GID},sourceId});
  const pr=await githubRead('/pulls/'+number);
  const markers=String(pr?.body||'').split(/\r?\n/);
  if(pr?.number!==number||pr?.html_url!==cells[11].trim()||
     pr?.head?.ref!==branch||pr?.base?.ref!=='main'||
     pr?.draft!==true||pr?.merged_at!=null||
     !/^[a-f0-9]{40}$/.test(pr?.head?.sha||'')||
     !markers.includes('source-id: '+sourceId)||
     !markers.includes('source-revision: '+prepared.fingerprint))
    throw new Error('e2e_pr_metadata_mismatch');
  const [matchingPrs,files]=await Promise.all([
    githubRead('/pulls?state=all&head='+encodeURIComponent('duykhang68:'+branch)+'&per_page=100'),
    githubRead('/pulls/'+number+'/files?per_page=100'),
  ]);
  if(!Array.isArray(matchingPrs)||matchingPrs.length!==1||matchingPrs[0]?.number!==number)
    throw new Error('e2e_duplicate_or_missing_pr');
  if(!Array.isArray(files)||files.length!==1||files[0]?.filename!==prepared.path||
     files[0]?.status!=='added')
    throw new Error('e2e_pr_article_file_mismatch');
  return {ok:true,sourceId,prNumber:number,prState:pr.state,draft:true,
    headSha:pr.head.sha,sourceRevision:prepared.fingerprint,releaseWriteback:false};
}

export async function verifyPublisherLiveReadOnly(env,{fetcher=fetch,expectedMainSha=env.GITHUB_SHA,sourceId=env.TBT_E2E_SOURCE_ID}={}){
  const required=['TBT_SHEETS_SPREADSHEET_ID','TBT_SHEETS_GID','TBT_GOOGLE_SERVICE_ACCOUNT_JSON','TBT_GITHUB_PUBLISHER_TOKEN'];
  for(const name of required){
    if(!String(env[name]||'').trim())throw new Error('Missing credential: '+name);
  }
  if(!HEX.test(expectedMainSha||''))throw new Error('Missing exact source SHA');
  const runtime={
    SHEETS_SPREADSHEET_ID:env.TBT_SHEETS_SPREADSHEET_ID,
    SHEETS_GID:env.TBT_SHEETS_GID,
    GOOGLE_SERVICE_ACCOUNT_JSON:env.TBT_GOOGLE_SERVICE_ACCOUNT_JSON,
    GITHUB_PUBLISHER_TOKEN:env.TBT_GITHUB_PUBLISHER_TOKEN,
  };
  const readonlyFetch=(input,options={})=>{
    const url=new URL(String(input));
    const method=options.method||'GET';
    if(['sheets.googleapis.com','api.github.com'].includes(url.hostname)&&method!=='GET')
      throw new Error('Read-only canary blocked a source write');
    if(url.hostname==='oauth2.googleapis.com'&&method!=='POST')
      throw new Error('Unexpected OAuth exchange');
    return fetcher(input,options);
  };
  const sheet=await readSheet(runtime,readonlyFetch);
  const main=await githubRequest(runtime,'/git/ref/heads/main',{fetcher:readonlyFetch});
  if(!HEX.test(main?.object?.sha||''))throw new Error('github_main_sha_invalid');
  const get=path=>readonlyFetch(DEV_URL+path,{method:'GET',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  const [healthResponse,rowsResponse,preflightResponse,adminResponse]=await Promise.all([
    get('/health'),get('/api/rows'),get('/api/preflight'),get('/admin'),
  ]);
  if(healthResponse.status!==200)throw new Error('worker_health_http_'+healthResponse.status);
  const health=await healthResponse.json();
  if(health?.app!=='techblogtip-publisher'||!HEX.test(health.releaseSha||''))
    throw new Error('worker_health_sha_invalid');
  if(rowsResponse.status!==401||preflightResponse.status!==401)
    throw new Error('anonymous_api_access_not_denied');
  if(adminResponse.status!==200||!(await adminResponse.text()).includes('noindex,nofollow'))
    throw new Error('publisher_admin_noindex_missing');
  const deployedSha=health.releaseSha;
  const history=await githubRequest(runtime,'/compare/'+deployedSha+'...'+expectedMainSha,{fetcher:readonlyFetch});
  if(!['ahead','identical'].includes(history?.status))
    throw new Error('publisher_sha_not_ancestor_of_source');
  const e2e=sourceId?.trim()?await auditPublisherSubmission(sheet.records,runtime,sourceId.trim(),
    path=>githubRequest(runtime,path,{fetcher:readonlyFetch})):null;
  return {
    ...(e2e?{e2e}:{}),
    sheet:{ok:true,rows:sheet.records.length},
    github:{ok:true,mainSha:main.object.sha},
    publisherDev:{ok:true,deployedSha,exactMainSha:deployedSha===expectedMainSha},
    anonymousDenied:true,
    draftPrWritePermission:'not_tested',
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  verifyPublisherLiveReadOnly(process.env).then(data=>{
    console.log('Publisher live read-only canary PASS:',JSON.stringify(data));
  }).catch(error=>{
    console.error('Publisher live read-only canary FAILED:',String(error.message||'verification_failed').slice(0,160));
    process.exitCode=1;
  });
}
