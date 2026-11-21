import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_CSS,STUDIO_EDITOR_JS,STUDIO_ADMIN_JS} from '../workers/publisher/src/studio-v2.mjs';
import {handleRequest} from '../workers/publisher/src/index.mjs';

test('Studio v2 scripts are standalone JavaScript without external UI dependencies',()=>{
 assert.doesNotThrow(()=>new Function(STUDIO_EDITOR_JS));
 assert.doesNotThrow(()=>new Function(STUDIO_ADMIN_JS));
 assert.match(STUDIO_CSS,/studio-settings/);
 assert.match(STUDIO_CSS,/max-width:700px/);
});
test('Studio uses protected existing session and import endpoints',()=>{
 for(const route of ['/api/draft','/api/approve','/api/submit'])assert.ok(STUDIO_EDITOR_JS.includes(route),route);
 assert.ok(STUDIO_EDITOR_JS.includes('techblogtip:draft-saved'));
 assert.ok(STUDIO_ADMIN_JS.includes('/api/articles'));
 assert.ok(STUDIO_EDITOR_JS.includes('Gửi xuất bản'));
 assert.ok(STUDIO_EDITOR_JS.includes('import'));
});
test('Editor and Admin retain their existing public shells with progressively enhanced scripts',async()=>{
 const editor=await handleRequest(new Request('https://publisher.example.test/editor'));
 assert.equal(editor.status,200);
 const html=await editor.text();
 assert.match(html,/editor-panel/);
 assert.match(html,/editor\.js/);
 const js=await handleRequest(new Request('https://publisher.example.test/editor.js'));
 assert.equal(js.status,200);
 const source=await js.text();
 assert.match(source,/studio-settings/);
 assert.match(source,/\/api\/approve/);
 const stylesheet=await handleRequest(new Request('https://publisher.example.test/admin.css'));
 assert.equal(stylesheet.status,200);
 assert.match(await stylesheet.text(),/studio-bar/);
});
test('new endpoints are not unauthenticated public write APIs',async()=>{
 for(const route of ['/api/articles','/api/approve']){
  const request=new Request('https://publisher.example.test'+route,{method:'POST',headers:{'Origin':'https://publisher.example.test','Content-Type':'application/json'},body:'{}'});
  const result=await handleRequest(request,{});
  assert.notEqual(result.status,200);
  assert.notEqual(result.status,201);
 }
});
