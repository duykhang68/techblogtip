import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Only trusted default-branch code runs here. Do not execute PR checkout or copy raw logs.
const tracked=new Set(['Quality','Workflow Security Audit','Deploy · Cloudflare staging']);
const errors=new Set(['failure','timed_out','startup_failure','action_required']);
export const actionable=r=>!!r && tracked.has(r.name) && errors.has(r.conclusion);
export const marker=r=>String(r.id)+'#'+String(r.run_attempt||1);
export const failedSteps=jobs=>jobs.filter(j=>errors.has(j.conclusion)).flatMap(j=>{
  const steps=(j.steps||[]).filter(s=>errors.has(s.conclusion));
  return (steps.length?steps:[{name:'(job did not reach a step)'}])
    .map(s=>({job:j.name||'(unknown)',step:s.name}));
});
export function fingerprint(run,jobs){
  const loc=[...new Set(failedSteps(jobs).map(s=>s.job+' > '+s.step))].sort().join('|');
  return createHash('sha256').update([run.workflow_id||run.name,run.head_branch||'unknown',loc||'no failed job'].join('\n')).digest('hex').slice(0,16);
}
export const knownRuns=body=>((String(body||'').match(/<!-- ci-runs: ([0-9#,]*) -->/)||[])[1]||'').split(',').filter(Boolean);
export function annotated(body,key,ids){
  const base=String(body||'').replace(/<!-- ci-key: [a-f0-9]{16} -->/g,'').replace(/<!-- ci-runs: [0-9#,]* -->/g,'').trimEnd();
  return base+'\n\n<!-- ci-key: '+key+' -->\n<!-- ci-runs: '+[...new Set(ids)].slice(-300).join(',')+' -->';
}
const clean=x=>String(x==null?'unknown':x).replace(/\s+/g,' ').slice(0,180);
export function synopsis(run,jobs){
  const steps=failedSteps(jobs);
  return [
    'Workflow: '+clean(run.name),
    'Run: '+run.html_url,
    'Branch: '+clean(run.head_branch),
    'Commit SHA: '+clean(run.head_sha),
    'Event: '+clean(run.event),
    'Result: '+clean(run.conclusion),
    'Attempt: '+(run.run_attempt||1),
    'Date: '+clean(run.created_at),
    'Failed steps:',
    ...(steps.length?steps.map(x=>'- '+clean(x.job)+' → '+clean(x.step)):['- No failing job detail available'])
  ].join('\n');
}
export function newBody(run,jobs,key){
  return annotated([
    '## CI incident — automatically recorded',
    '',
    synopsis(run,jobs),
    '',
    '## Follow-up',
    '- Diagnose using the linked run while original logs are retained by GitHub.',
    '- Document root cause, remedy, and lessons learned in this issue.',
    '- Raw CI logs are NOT copied here to avoid exposing secrets.',
    '- Reference this issue in the fixing PR and close after green CI and exact-SHA verification.',
    '- Recurrences of the same workflow/branch/step are appended as comments.',
  ].join('\n'),key,[marker(run)]);
}
function github(repo,token){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!token) throw Error('Missing repository or token');
  return async (path,method='GET',data)=>{
    const res=await fetch('https://api.github.com'+path,{
      method,
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      ...(data?{body:JSON.stringify(data)}:{})
    });
    if(!res.ok){const e=Error('GitHub API HTTP '+res.status+' for '+method+' '+path.split('?')[0]);e.status=res.status;throw e;}
    return res.status===204?null:res.json();
  };
}
async function label(api,repo,name,color,description){
  try{await api('/repos/'+repo+'/labels/'+encodeURIComponent(name));}
  catch(e){
    if(e.status!==404)throw e;
    try{await api('/repos/'+repo+'/labels','POST',{name,color,description});}
    catch(z){if(z.status!==422)throw z;}
  }
}
async function issues(api,repo){
  const all=[];
  for(let p=1;p<=10;p++){
    const batch=await api('/repos/'+repo+'/issues?state=all&per_page=100&page='+p);
    all.push(...batch.filter(i=>!i.pull_request));
    if(batch.length<100)return all;
  }
  throw Error('Issue listing exceeded 1000 items; refusing unsafe deduplication');
}
async function jobs(api,repo,run){
  const all=[];
  for(let p=1;p<=5;p++){
    const batch=(await api('/repos/'+repo+'/actions/runs/'+run.id+'/jobs?per_page=100&page='+p)).jobs||[];
    all.push(...batch);
    if(batch.length<100)return all;
  }
  throw Error('Too many workflow jobs for reliable signature');
}
async function runs(api,repo,event,eventName,lookback){
  if(eventName==='workflow_run')return actionable(event.workflow_run)?[event.workflow_run]:[];
  const n=Number(lookback||7);
  const days=Number.isInteger(n)?Math.max(1,Math.min(14,n)):7;
  const after=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
  const all=[];
  for(let p=1;p<=10;p++){
    const batch=(await api('/repos/'+repo+'/actions/runs?created='+encodeURIComponent('>='+after)+'&per_page=100&page='+p)).workflow_runs||[];
    all.push(...batch.filter(actionable));
    if(batch.length<100)return all.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  }
  throw Error('Too many runs for the backfill window');
}
export async function collect({repo,token,event,eventName,lookback}){
  const api=github(repo,token),bad=await runs(api,repo,event,eventName,lookback);
  if(!bad.length){console.log('No failures to collect');return;}
  await label(api,repo,'ci-incident','D8B4FE','CI / deploy failure recorded automatically');
  await label(api,repo,'needs-triage','FED7AA','Awaiting diagnosis and verified resolution');
  const all=await issues(api,repo);
  const counts={reviewed:bad.length,created:0,updated:0,skipped:0};
  for(const run of bad){
    const failed=await jobs(api,repo,run),key=fingerprint(run,failed),keyTag='<!-- ci-key: '+key+' -->';
    const issue=all.find(i=>i.state==='open'&&i.body?.includes(keyTag))||
      all.find(i=>i.state==='open'&&i.body?.includes('/actions/runs/'+run.id));
    if(!issue){
      const archived=all.some(i=>i.state==='closed'&&i.body?.includes(keyTag)&&Date.parse(i.closed_at||'')>=Date.parse(run.created_at));
      if(archived){counts.skipped++;continue;}
      const where=failedSteps(failed)[0];
      const title=('[CI] '+run.name+': '+(where?where.job+' / '+where.step:'workflow failure')+' ('+(run.head_branch||'unknown')+')').slice(0,180);
      const created=await api('/repos/'+repo+'/issues','POST',{
        title,body:newBody(run,failed,key),labels:['ci-incident','needs-triage']
      });
      all.push(created);counts.created++;
      console.log('Created incident #'+created.number+': '+run.html_url);
      continue;
    }
    if(knownRuns(issue.body).includes(marker(run))){counts.skipped++;continue;}
    await api('/repos/'+repo+'/issues/'+issue.number+'/comments','POST',{
      body:'### '+(issue.body?.includes(keyTag)?'Recurring failure':'Linked existing manual issue')+
        '\n\n'+synopsis(run,failed)+'\n\n_Raw logs intentionally not copied._'
    });
    const labels=[...new Set([...(issue.labels||[]).map(l=>typeof l==='string'?l:l.name),'ci-incident','needs-triage'])];
    const updated=await api('/repos/'+repo+'/issues/'+issue.number,'PATCH',{
      body:annotated(issue.body,key,[...knownRuns(issue.body),marker(run)]),labels
    });
    Object.assign(issue,updated);counts.updated++;
    console.log('Updated incident #'+issue.number+': '+run.html_url);
  }
  console.log(JSON.stringify(counts));
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  await collect({repo:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN,
    event,eventName:process.env.GITHUB_EVENT_NAME,lookback:process.env.LOOKBACK_DAYS});
}
