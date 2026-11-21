import test from 'node:test';
import assert from 'node:assert/strict';
import {obsidianPreview} from '../workers/publisher/src/obsidian-import.mjs';

test('plain notes may be edited without forced review',()=>{
 const out=obsidianPreview({path:'notes/hello.md',markdown:'# Xin chào'});
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
