import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/korea-cv/src/index.mjs';
const call=(path,init={},env={})=>worker.fetch(new Request('https://worker.example'+path,init),env);
test('private Korea CV API fails closed without Google OAuth config',async()=>{
 const r=await call('/api/korea-cv',{headers:{Origin:'https://duykhang68.github.io'}});
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{error:'not_configured'});
 assert.equal(r.headers.get('Cache-Control'),'private, no-store');
});
test('rejects foreign origins before authorization',async()=>{
 const r=await call('/api/korea-cv',{headers:{Origin:'https://attacker.example'}},{GOOGLE_OAUTH_CLIENT_ID:'example'});
 assert.equal(r.status,403);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});
test('does not allow unauthenticated listing of CV files',async()=>{
 const r=await call('/api/korea-cv',{headers:{Origin:'https://duykhang68.github.io'}},{GOOGLE_OAUTH_CLIENT_ID:'example'});
 assert.equal(r.status,401);
});
test('restricted CORS preflight',async()=>{
 const r=await call('/api/korea-cv',{method:'OPTIONS',headers:{Origin:'https://duykhang68.github.io'}});
 assert.equal(r.status,204);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://duykhang68.github.io');
});

test('DEV health returns exact source SHA without requiring Google auth',async()=>{
 const sha='0123456789abcdef0123456789abcdef01234567';
 const r=await call('/health',{}, {RELEASE_SHA:sha});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.releaseSha,sha);
 assert.equal(body.service,'korea-cv-drive-gateway');
 assert.equal(r.headers.get('Cache-Control'),'private, no-store');
});
