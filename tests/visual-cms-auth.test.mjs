import test from 'node:test';
import assert from 'node:assert/strict';
import cms from '../apps/visual-cms/src/index.mjs';
import {publishedHTML} from '../apps/visual-cms/src/published-page.mjs';
const url='https://techblogtip-visual-cms.tamsudev-com.workers.dev';
const env={CMS_DB:{},CMS_ADMINS:'owner@example.com',GOOGLE_CLIENT_ID:'86180355982-ucstas5q9h5j10hedc1lruo3pg4v8h5f.apps.googleusercontent.com'};
test('health is available and signals Google ID-token auth',async()=>{
 const res=await cms.fetch(new Request(url+'/health'),env);
 assert.equal(res.status,200);const body=await res.json();assert.equal(body.authentication,'google-id-token');assert.equal(body.configured,true);
});
test('CMS admin directs to GitHub Pages Google OAuth origin',async()=>{
 const res=await cms.fetch(new Request(url+'/admin',{redirect:'manual'}),env);
 assert.equal(res.status,302);assert.equal(res.headers.get('location'),'https://duykhang68.github.io/techblogtip/tools/cms/');
});
test('private API rejects absent and malformed Google bearer',async()=>{
 assert.equal((await cms.fetch(new Request(url+'/api/me'),env)).status,401);
 assert.equal((await cms.fetch(new Request(url+'/api/me',{headers:{Authorization:'Bearer bad.token'}}),env)).status,401);
});
test('API CORS is scoped to authorized Github Pages origin',async()=>{
 const pass=await cms.fetch(new Request(url+'/api/pages',{method:'OPTIONS',headers:{Origin:'https://duykhang68.github.io'}}),env);
 assert.equal(pass.status,204);assert.equal(pass.headers.get('access-control-allow-origin'),'https://duykhang68.github.io');
 const fail=await cms.fetch(new Request(url+'/api/pages',{method:'OPTIONS',headers:{Origin:'https://evil.invalid'}}),env);
 assert.equal(fail.status,403);
});
test('published web page escapes user content and refuses unsafe links',()=>{
 const h=publishedHTML({title:'<script>',description:'desc',locale:'vi',blocks:[{type:'paragraph',props:{text:'<img src=x>'}},{type:'button',props:{url:'javascript:alert(1)',label:'unsafe'}}]});
 assert.ok(h.includes('&lt;script&gt;'));assert.ok(!h.includes('javascript:alert(1)'));assert.ok(!h.includes('<img src=x>'));
});
