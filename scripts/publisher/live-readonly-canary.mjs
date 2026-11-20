// Trusted main only. Verify live publisher wiring without changing Sheets or GitHub.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readSheet } from '../../workers/publisher/src/google-api.mjs';
import { githubRequest } from '../../workers/publisher/src/github-api.mjs';

const DEV_URL='https://techblogtip-publisher-dev.tamsudev-com.workers.dev';
const HEX=/^[a-f0-9]{40}$/;
export async function verifyPublisherLiveReadOnly(env,{fetcher=fetch,expectedMainSha=env.GITHUB_SHA}={}){
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
  return {
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
