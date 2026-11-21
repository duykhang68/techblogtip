import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import cmsHTML from '../apps/visual-cms/src/ui.mjs';
test('Visual CMS static HTML has valid inline JavaScript',()=>{
 const match=cmsHTML.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'CMS has inline controller');
 assert.doesNotThrow(()=>new Script(match[1]));
});
test('Visual CMS authoring controls exist and preserve Google-only authentication',()=>{
 for(const pattern of ['id="google-login"','id="auth-panel"','id="workspace"','id="signout"','id="public-page"','id="preview-toggle"','b.id=\'rail-\'+id','function publishedLink','function setupRail','function drawCanvas','palette-entry','layer-entry']){
  assert.ok(cmsHTML.includes(pattern),pattern);
 }
 assert.ok(!cmsHTML.includes('CF_Authorization'));
 assert.ok(!cmsHTML.includes('ACCESS_AUD'));
});
test('static CMS page is mirrored to Pages origin',async()=>{
 const {readFileSync}=await import('node:fs');
 const page=readFileSync('public/tools/cms/index.html','utf8');
 assert.equal(page,cmsHTML);
 assert.ok(page.includes('noindex,nofollow'));
 assert.ok(page.includes('https://accounts.google.com/gsi/client'));
});
