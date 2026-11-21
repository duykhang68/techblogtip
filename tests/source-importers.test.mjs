import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDriveId} from '../workers/publisher/src/drive-import.mjs';
import {notionId,notionMarkdown,notionPagePreview} from '../workers/publisher/src/notion-import.mjs';
import {safeVaultPath,obsidianPreview} from '../workers/publisher/src/obsidian-import.mjs';
test('Drive IDs are restricted',()=>{assert.equal(assertDriveId('abcdef123456789'),'abcdef123456789');assert.throws(()=>assertDriveId('../secret'));});
test('Notion blocks render basic content',()=>{assert.equal(notionId('0123456789abcdef0123456789abcdef'),'0123456789abcdef0123456789abcdef');assert.match(notionMarkdown([{type:'heading_2',heading_2:{rich_text:[{plain_text:'Hello'}]}}]),/## Hello/);});
test('Obsidian only imports selected safe notes',()=>{assert.throws(()=>safeVaultPath('../secret.md'));const p=obsidianPreview({path:'notes/a.md',markdown:'---\ntitle: Article\n---\n# Intro\n![[img/a.png]]'});assert.equal(p.title,'Article');assert.deepEqual(p.missingAttachments,['img/a.png']);});

test('Notion pagination cannot silently stop or loop when cursor is malformed',async()=>{
 const id='0123456789abcdef0123456789abcdef';
 const info={properties:{title:{type:'title',title:[{plain_text:'Ví dụ'}]}}};
 const failCursor=async url=>({ok:true,json:async()=>url.includes('/pages/')?info:{results:[],has_more:true,next_cursor:null}});
 await assert.rejects(notionPagePreview({id,token:'test-in-memory',fetcher:failCursor}),/Missing pagination cursor/);
 const repeat=async url=>({ok:true,json:async()=>url.includes('/pages/')?info:{results:[],has_more:true,next_cursor:'same'}});
 await assert.rejects(notionPagePreview({id,token:'test-in-memory',fetcher:repeat}),/Repeated pagination cursor/);
});
test('Obsidian complex syntax remains in review until lossless support exists',()=>{
 const previews=[
  {path:'notes/frontmatter.md',markdown:'---\ntitle: X\n  nested: YAML\n---\nPlain'},
  {path:'notes/link.md',markdown:'Read [reference](https://example.com)'},
  {path:'notes/code.md',markdown:'~~~js\nconst x = 1\n~~~'},
  {path:'notes/table.md',markdown:'| A | B |\n|---|---|\n| 1 | 2 |'},
  {path:'notes/html.md',markdown:'<aside>Example</aside>'},
  {path:'notes/wiki.md',markdown:'Broken [[link'}
 ];
 for(const input of previews)assert.equal(obsidianPreview(input).requiresReview,true,input.path);
 const safe=obsidianPreview({path:'notes/simple.md',markdown:'---\ntitle: Ví dụ tiếng Việt\n---\nĐoạn văn không mất dữ liệu'});
 assert.equal(safe.requiresReview,false);
 assert.match(safe.body,/Đoạn văn không mất dữ liệu/);
});
