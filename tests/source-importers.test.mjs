import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDriveId} from '../workers/publisher/src/drive-import.mjs';
import {notionId,notionMarkdown} from '../workers/publisher/src/notion-import.mjs';
import {safeVaultPath,obsidianPreview} from '../workers/publisher/src/obsidian-import.mjs';
test('Drive IDs are restricted',()=>{assert.equal(assertDriveId('abcdef123456789'),'abcdef123456789');assert.throws(()=>assertDriveId('../secret'));});
test('Notion blocks render basic content',()=>{assert.equal(notionId('0123456789abcdef0123456789abcdef'),'0123456789abcdef0123456789abcdef');assert.match(notionMarkdown([{type:'heading_2',heading_2:{rich_text:[{plain_text:'Hello'}]}}]),/## Hello/);});
test('Obsidian only imports selected safe notes',()=>{assert.throws(()=>safeVaultPath('../secret.md'));const p=obsidianPreview({path:'notes/a.md',markdown:'---\ntitle: Article\n---\n# Intro\n![[img/a.png]]'});assert.equal(p.title,'Article');assert.deepEqual(p.missingAttachments,['img/a.png']);});
