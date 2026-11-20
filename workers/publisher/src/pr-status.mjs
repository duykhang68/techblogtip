import { fail, PublisherError } from './auth.mjs';
import { githubRequest, branchFor } from './github-api.mjs';

const PR_LINK=/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/([1-9][0-9]*)$/;
const SHA=/^[a-f0-9]{40}$/;
const REVISION=/^[a-f0-9]{64}$/;
const CONCLUSIONS=new Set(['success','failure','neutral','cancelled','skipped','timed_out','action_required','stale','startup_failure']);

export async function inspectPublisherPR(env,row,sourceId,fetcher=fetch){
  if(row?.cells?.[0]?.trim()!==sourceId)
    fail(409,'source_conflict','Source ID changed');
  const prUrl=String(row.cells[11]||'').trim();
  const match=PR_LINK.exec(prUrl);
  if(!match)fail(409,'pr_not_registered','No trusted TechBlogTip PR registered for this source');
  const revision=String(row.cells[10]||'').trim();
  if(!REVISION.test(revision))
    fail(409,'source_hash_missing','Source revision is missing');
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number)||number>100000000)
    fail(400,'pr_number_invalid','Invalid pull request number');
  const pr=await githubRequest(env,'/pulls/'+number,{fetcher});
  const branch=await branchFor({sourceId,source:{
    spreadsheetId:String(env.SHEETS_SPREADSHEET_ID||''),
    sheetGid:String(env.SHEETS_GID||'')
  }});
  const markers=String(pr?.body||'').split(/\r?\n/);
  const matching=pr?.number===number&&pr?.html_url===prUrl&&
    pr?.base?.ref==='main'&&pr?.head?.ref===branch&&
    pr?.head?.repo?.full_name==='duykhang68/techblogtip'&&
    markers.includes('source-id: '+sourceId)&&
    markers.includes('source-revision: '+revision);
  if(!matching)
    fail(409,'pr_source_mismatch','GitHub PR does not match the pinned Sheets source');
  const headSha=pr?.head?.sha;
  if(!SHA.test(headSha||''))
    fail(502,'pr_sha_invalid','GitHub PR head SHA is missing or invalid');
  const stage=pr.merged_at?'merged':pr.state==='closed'?'closed_unmerged':
    pr.state==='open'?(pr.draft?'draft':'review'):'unknown';
  let ci={availability:'unavailable',checkedSha:headSha,checks:[]};
  if(stage==='draft'||stage==='review'){
    try{
      const response=await githubRequest(env,'/commits/'+headSha+'/check-runs?per_page=100',{fetcher});
      if(!Array.isArray(response?.check_runs))throw new Error('Invalid check-runs response');
      const checks=response.check_runs.slice(0,100).map(c=>({
        name:String(c.name||'Unnamed check').slice(0,110),
        status:c.status==='completed'?'completed':'pending',
        conclusion:CONCLUSIONS.has(c.conclusion)?c.conclusion:null,
      }));
      ci={availability:response.total_count>100?'partial':'available',checkedSha:headSha,checks};
    }catch(error){
      // Missing optional Checks:read permission is not a successful CI result.
      if(!(error instanceof PublisherError)&&error.message!=='Invalid check-runs response')
        throw error;
    }
  }
  return {sourceId,prUrl,number,stage,headSha,productionVerified:false,ci};
}
