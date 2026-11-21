import test from 'node:test';
import assert from 'node:assert/strict';
import {obsidianPreview} from '../workers/publisher/src/obsidian-import.mjs';

test('plain notes may be edited without forced review',()=>{
 const out=obsidianPreview({path:'notes/hello.md',markdown:'## Xin chào'});
 assert.equal(out.requiresReview,false);
 assert.deepEqual(out.unresolvedLinks,[]);
});
test('wikilinks cannot silently lose vault references',()=>{
 const out=obsidianPreview({path:'notes/a.md',markdown:'See [[folder/b|Bài B]]'});
 assert.equal(out.requiresReview,true);
 assert.deepEqual(out.unresolvedLinks,['folder/b']);
 assert.match(out.body,/Bài B/);
});
test('missing embedded media remains blocked for review',()=>{
 const out=obsidianPreview({path:'notes/a.md',markdown:'![[photo.png]]'});
 assert.equal(out.requiresReview,true);
 assert.deepEqual(out.missingAttachments,['photo.png']);
});

test('Obsidian picker accepts multiple local notes but imports only selected note into editable DRAFT',async()=>{
 const {EDITOR_HTML,EDITOR_JS}=await import('../workers/publisher/src/editor-ui.mjs');
 assert.match(EDITOR_HTML,/id="import-obsidian-file"[^>]*multiple/);
 assert.match(EDITOR_HTML,/id="import-obsidian-choice"/);
 assert.match(EDITOR_JS,/files\[index\]/);
 assert.match(EDITOR_JS,/files\.length>50/);
 assert.match(EDITOR_JS,/file\.webkitRelativePath\|\|file\.name/);
 assert.match(EDITOR_JS,/window\.confirm\(/);
});
