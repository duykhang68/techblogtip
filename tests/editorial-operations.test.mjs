import test from 'node:test';
import assert from 'node:assert/strict';
import {readEditorialOperations} from '../workers/publisher/src/editorial-operations.mjs';
import {PRODUCTION_HTML,PRODUCTION_JS} from '../workers/publisher/src/production-ui.mjs';
import {handleRequest} from '../workers/publisher/src/index.mjs';

test('C3 operations snapshot is read-only, with independent source availability',async()=>{
 const calls=[];
 const env={GITHUB_PUBLISHER_TOKEN:'test-token'};
 const fetcher=async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET'});
  if(String(url).includes('/actions/runs?'))return Response.json({workflow_runs:[
   {id:99,name:'Quality',status:'completed',conclusion:'success',head_sha:'a'.repeat(40)},
   {id:100,name:'Deploy · GitHub Pages production',status:'completed',conclusion:'failure',head_sha:'b'.repeat(40)},
   {id:101,name:'Unrelated workflow',status:'completed',conclusion:'success',head_sha:'c'.repeat(40)}
  ]});
  throw Error('unconfigured sheet fixture');
 };
 const snapshot=await readEditorialOperations(env,fetcher);
 assert.equal(snapshot.sheet.available,false);
 assert.equal(snapshot.workflows.available,true);
 assert.equal(snapshot.workflows.sampled,2);
 assert.deepEqual(snapshot.workflows.totals,{success:1,failure:1,in_progress:0,other:0});
 assert.equal(snapshot.workflows.items[0].url,'https://github.com/duykhang68/techblogtip/actions/runs/99');
 assert.ok(calls.every(x=>x.method==='GET'));
});
test('C3 UI reads only protected Worker endpoints and handles failures',()=>{
 assert.match(PRODUCTION_HTML,/production-ops-data/);
 assert.match(PRODUCTION_JS,/api\/editorial-operations/);
 assert.doesNotMatch(PRODUCTION_JS,/api\.github\.com|setInterval|setTimeout/);
 assert.doesNotThrow(()=>new Function(PRODUCTION_JS));
});
test('C3 rejects unauthenticated access without hitting external services',async()=>{
 const response=await handleRequest(new Request('https://publisher.example.test/api/editorial-operations'),{},{
  fetcher:()=>{throw Error('anonymous must not fetch external resources');}
 });
 assert.equal(response.status,401);
});
