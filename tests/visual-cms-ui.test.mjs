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

test('Focus Workspace uses full viewport height and independently scrollable editing panels',()=>{
 for(const marker of [
  'height:calc(100dvh - 56px)',
  'min-height:0;overflow:hidden',
  '.frame{display:flex',
  '.inspect-body{flex:1',
  '.grid.focus-mode',
  '@media(max-width:700px)',
  'id="nav-toggle"',
  'id="inspect-toggle"',
  'id="focus-toggle"',
  'id="panel-scrim"',
  'id="save-status"',
 ])assert.ok(cmsHTML.includes(marker), 'workspace marker missing: '+marker);
 assert.ok(!cmsHTML.includes('CF_Authorization'));
});

test('Focus Workspace supports independent panel toggles, keyboard escape, mobile drawers and full preview',()=>{
 for(const marker of [
   'function updateWorkspacePanels()',
   'function setupEditorWorkspace()',
   'function toggleWorkspacePanel(side)',
   'function toggleFocusMode()',
   'function revealInspector()',
   "window.addEventListener('resize',updateWorkspacePanels)",
   "if(e.key==='Escape')",
   'function previewToggle()',
   "workspace.classList.toggle('focus-mode')",
   "workspace.classList.add('right-collapsed')",
 ])assert.ok(cmsHTML.includes(marker),'missing UX behavior: '+marker);
});
