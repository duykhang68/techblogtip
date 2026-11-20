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
export async function createDraftPR(env,prepared,fetcher=fetch){
  const branch=await branchFor(prepared);
  const sourceMarker='source-id: '+prepared.sourceId;
  const revisionMarker='source-revision: '+prepared.sourceRevision;
  const request=(path,params={})=>githubRequest(env,path,{fetcher,...params});
  const existing=await request('/pulls?state=open&head='+encodeURIComponent(OWNER+':'+branch)+'&per_page=10');
  if(!Array.isArray(existing))fail(502,'github_api','Unexpected GitHub pull request response');
  if(existing.length){
    const pr=existing[0];
    if(pr.base?.ref!=='main'||!pr.draft||!pr.body?.includes(sourceMarker))
      fail(409,'branch_conflict','An unrelated/ready PR occupies this source branch');
    if(!pr.body.includes(revisionMarker))
      fail(409,'revision_conflict','An existing source PR has another revision; review it first');
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
