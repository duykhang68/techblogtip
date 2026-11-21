import { stageArticleMedia } from './media-library.mjs';
import { fail } from './auth.mjs';

const ROOT='https://api.github.com/repos/duykhang68/techblogtip';
const OWNER='duykhang68';
const API_VERSION='2022-11-28';
export async function githubRequest(env,path,{method='GET',body,fetcher=fetch,missingOk=false}={}){
  if(!env.GITHUB_PUBLISHER_TOKEN)fail(503,'github_not_configured','GitHub publisher token missing');
  const response=await fetcher(ROOT+path,{
    method,
    headers:{
      Authorization:'Bearer '+env.GITHUB_PUBLISHER_TOKEN,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':API_VERSION,
      'User-Agent':'techblogtip-publisher',
      ...(body?{'Content-Type':'application/json'}:{}),
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(12000),
  });
  if(missingOk&&response.status===404)return null;
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    if([409,422].includes(response.status))fail(409,'github_conflict','Branch, path or PR conflicts with an existing GitHub object');
    if(response.status===404)fail(404,'github_not_found','GitHub repository resource not found');
    fail(502,'github_api','GitHub publishing API returned HTTP '+response.status);
  }
  return result;
}
function encodeContent(content){
  const b=new TextEncoder().encode(content);let s='';
  for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));
  return btoa(s);
}
export async function branchFor(prepared){
  const id=prepared.source.spreadsheetId+':'+prepared.source.sheetGid+':'+prepared.sourceId;
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)));
  const tag=[...digest].slice(0,10).map(v=>v.toString(16).padStart(2,'0')).join('');
  return 'sheets/tbt-'+tag;
}
// Verify an already-registered PR without creating another branch or PR.
// Source ID/revision are compared as full metadata lines, not string prefixes.
function validSourcePR(pr,prepared,branch,url){
  const lines=String(pr?.body||'').split(/\r?\n/);
  return pr?.html_url===url&&
    pr?.base?.ref==='main'&&pr?.head?.ref===branch&&
    pr?.head?.repo?.full_name==='duykhang68/techblogtip'&&
    lines.includes('source-id: '+prepared.sourceId)&&
    lines.includes('source-revision: '+prepared.sourceRevision);
}

export async function inspectSubmittedSourcePR(env,prepared,storedUrl,fetcher=fetch){
  const match=/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/([1-9][0-9]*)$/.exec(String(storedUrl||''));
  if(!match)fail(409,'pr_conflict','Stored PR is not a trusted TechBlogTip link');
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number)||number>100000000)
    fail(409,'pr_conflict','Stored PR number is invalid');
  const branch=await branchFor(prepared);
  const pr=await githubRequest(env,'/pulls/'+number,{fetcher});
  if(pr?.number!==number||!validSourcePR(pr,prepared,branch,storedUrl))
    fail(409,'pr_conflict','Stored PR no longer matches the submitted source');
  const stage=pr.state==='closed'?(pr.merged_at?'merged':'closed'):(pr.draft?'draft':'ready');
  if(!['open','closed'].includes(pr.state))
    fail(409,'pr_conflict','Stored PR has unknown state');
  return {created:false,number,url:storedUrl,branch,stage};
}

export async function createDraftPR(env,prepared,fetcher=fetch){
  const branch=await branchFor(prepared);
  const sourceMarker='source-id: '+prepared.sourceId;
  const revisionMarker='source-revision: '+prepared.sourceRevision;
  const request=(path,params={})=>githubRequest(env,path,{fetcher,...params});
  const existing=await request('/pulls?state=open&head='+encodeURIComponent(OWNER+':'+branch)+'&per_page=10');
  if(!Array.isArray(existing))fail(502,'github_api','Unexpected GitHub pull request response');
  if(existing.length){
    const pr=existing[0];
    if(!pr.draft||pr.state!=='open'||!validSourcePR(pr,prepared,branch,pr.html_url))
      fail(409,'branch_conflict','An unrelated, changed or ready PR occupies this source branch');
    return {created:false,number:pr.number,url:pr.html_url,branch};
  }
  if(await request('/git/ref/heads/'+branch,{missingOk:true}))
    fail(409,'orphan_branch','Orphan source branch exists; manual recovery is required');
  if(await request('/contents/'+prepared.path+'?ref=main',{missingOk:true}))
    fail(409,'slug_conflict','An article already exists at this slug on main');
  const main=await request('/git/ref/heads/main');
  if(!/^[0-9a-f]{40}$/.test(main?.object?.sha||''))
    fail(502,'github_ref_invalid','GitHub main SHA could not be validated');
  await request('/git/refs',{method:'POST',body:{ref:'refs/heads/'+branch,sha:main.object.sha}});
  await request('/contents/'+prepared.path,{
    method:'PUT',body:{
      message:'content(sheets): add '+prepared.sourceId+' as draft',
      content:encodeContent(prepared.markdown),branch,
    }
  });
  await stageArticleMedia(env,prepared,branch,fetcher);
  const pr=await request('/pulls',{
    method:'POST',body:{
      title:'content(sheets): '+prepared.sourceId,
      head:branch,base:'main',draft:true,
      body:[
        'Imported by the authorized TechBlogTip Google Sheets Publisher.',
        '',
        sourceMarker,
        revisionMarker,
        '',
        'Draft-first • human review • FIFO merge • exact SHA deployment.',
        'No automatic production publishing or source-sheet release writeback.',
      ].join('\n'),
    }
  });
  return {created:true,number:pr.number,url:pr.html_url,branch};
}
