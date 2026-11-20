import test from 'node:test';
import assert from 'node:assert/strict';
import {readProductionStatus} from '../workers/publisher/src/production-status.mjs';
import {PRODUCTION_HTML,PRODUCTION_JS,PRODUCTION_CSS} from '../workers/publisher/src/production-ui.mjs';
import {handleRequest} from '../workers/publisher/src/index.mjs';

const main='a'.repeat(40),previous='b'.repeat(40);
const env={GITHUB_PUBLISHER_TOKEN:'mock-token'};
const root='https://api.github.com/repos/duykhang68/techblogtip';
function fixture({denyActions=false,unavailableStaging=false}={}){
 const calls=[];
 const fetcher=async(input,options={})=>{
  const url=new URL(String(input)),method=options.method||'GET';
  calls.push({url:url.href,method,authorization:options.headers?.Authorization||''});
  assert.equal(method,'GET','snapshot cannot make writes');
  if(url.hostname==='api.github.com'){
    assert.equal(options.headers.Authorization,'Bearer mock-token');
    if(url.pathname===new URL(root).pathname+'/git/ref/heads/main')
      return Response.json({object:{sha:main}});
    if(url.pathname===new URL(root).pathname+'/pulls')
      return Response.json([
        {number:36,draft:true,title:'First PR',head:{sha:previous}},
        {number:37,draft:false,title:'Progress PR',head:{sha:main}},
      ]);
    if(url.pathname===new URL(root).pathname+'/actions/runs'){
      if(denyActions)return Response.json({message:'Forbidden'}, {status:403});
      return Response.json({workflow_runs:[
        {id:44838990730,name:'Quality',status:'completed',conclusion:'failure',
         head_sha:main,updated_at:'2026-11-20T23:45:08Z',event:'pull_request',
         html_url:'https://github.com/duykhang68/techblogtip/actions/runs/44838990730'}
      ]});
    }
    return Response.json({message:'not found'},{status:404});
  }
  if(url.hostname==='techblogtip-staging.tamsudev-com.workers.dev'){
    if(unavailableStaging)return Response.json({message:'unavailable'},{status:500});
    return Response.json({project:'techblogtip',sha:previous,ref:'main',builtAt:'2026-11-20T23:31:00Z'});
  }
  if(url.hostname==='techblogtip-publisher-dev.tamsudev-com.workers.dev')
    return Response.json({app:'techblogtip-publisher',releaseSha:main,sourceWriteLocks:true});
  throw Error('Unexpected external URL '+url);
 };
 return {calls,fetcher};
}
test('read-only Production Status snapshot lists queue, actions and public staging separately',async()=>{
 const f=fixture(),s=await readProductionStatus(env,f.fetcher);
 assert.equal(s.repo,'duykhang68/techblogtip');
 assert.equal(s.main.sha,main);
 assert.equal(s.queue.count,2);
 assert.equal(s.queue.items[0].number,36);
 assert.equal(s.queue.items[0].draft,true);
 assert.equal(s.actions.items[0].conclusion,'failure');
 assert.equal(s.staging.available,true);
 assert.equal(s.staging.matchesMain,false);
 assert.equal(s.publisherDev.matchesMain,true);
 assert.equal(s.production.verified,false);
 assert.equal(s.production.status,'not_configured');
 assert.ok(f.calls.every(c=>c.method==='GET'));
});
test('Actions: Read denied displays unavailable instead of PASS',async()=>{
 const f=fixture({denyActions:true,unavailableStaging:true});
 const s=await readProductionStatus(env,f.fetcher);
 assert.equal(s.actions.available,false);
 assert.equal(s.staging.available,false);
 assert.equal(s.main.available,true);
 assert.equal(s.production.verified,false);
});
test('Production Status UI is last in admin and never calls browser GitHub API',async()=>{
 assert.ok(PRODUCTION_HTML.includes('id="production-status"'));
 assert.ok(PRODUCTION_HTML.includes('Production Status'));
 assert.ok(PRODUCTION_HTML.includes('id="production-refresh"'));
 assert.ok(PRODUCTION_JS.includes('/api/production-status'));
 assert.ok(!PRODUCTION_JS.includes('api.github.com'));
 assert.ok(PRODUCTION_JS.includes('addEventListener'));
 assert.ok(PRODUCTION_CSS.includes('.production-environments'));
 assert.doesNotThrow(()=>new Function(PRODUCTION_JS));
 const html=await (await handleRequest(new Request('https://publisher.example.test/admin'),{GOOGLE_OAUTH_CLIENT_ID:'test.apps.googleusercontent.com'})).text();
 assert.ok(html.includes('id="production-status"'));
 assert.ok(html.indexOf('id="editor-panel"')<html.indexOf('id="production-status"'));
 assert.ok(html.includes('/production-status.js'));
 const script=await (await handleRequest(new Request('https://publisher.example.test/production-status.js'),{})).text();
 assert.equal(script,PRODUCTION_JS);
});
test('Anonymous editor cannot fetch Production Status snapshot',async()=>{
 const response=await handleRequest(new Request('https://publisher.example.test/api/production-status'),{},{
  fetcher:()=>{throw Error('Anonymous request must never fetch GitHub');}
 });
 assert.equal(response.status,401);
});
