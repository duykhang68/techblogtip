import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import handler from '../apps/gcms/src/index.mjs';

const html=readFileSync(new URL('../public/gcms/index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../apps/gcms/migrations/0001_init.sql',import.meta.url),'utf8');
const footer=readFileSync(new URL('../src/components/SiteFooter.astro',import.meta.url),'utf8');

test('G-CMS admin shell parses and never ships credentials',()=>{
 const js=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(js,'Expected inline controller');
 assert.doesNotThrow(()=>new Script(js[1]));
 assert.match(html,/id="signin"/);
 assert.match(html,/data-view="posts"/);
 assert.match(html,/data-view="members"/);
 assert.match(html,/data-view="tiers"/);
 assert.match(html,/noindex,nofollow/);
 assert.doesNotMatch(html,/client_secret|service_account|BEGIN PRIVATE KEY/i);
});

test('G-CMS schema covers private content, revision, audit and public projection',()=>{
 for(const table of ['gcms_entries','gcms_versions','gcms_members','gcms_newsletters','gcms_tiers','gcms_media','gcms_audit'])
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS '+table),table);
 assert.match(sql,/published_json TEXT/);
 assert.match(sql,/CHECK\(visibility IN \('public','members','paid'\)\)/);
});

test('G-CMS footer link and isolation',()=>{
 assert.match(footer,/withBase\('\/gcms\/'\)/);
 assert.match(footer,/withBase\('\/tools\/cms\/'\)/,'existing Visual CMS link preserved');
 assert.doesNotMatch(html,/google\.com\/drive\/v3|sheets\.googleapis\.com/);
});

test('no unauthenticated access to G-CMS admin endpoints',async()=>{
 const base='https://techblogtip-gcms.tamsudev-com.workers.dev';
 let result=await handler.fetch(new Request(base+'/api/me'),{GCMS_DB:{}});
 assert.equal(result.status,503); // OAuth not configured, fail closed
 result=await handler.fetch(new Request(base+'/health'),{});
 assert.equal(result.status,200);
 assert.equal((await result.json()).configured,false);
 result=await handler.fetch(new Request(base+'/api/stats',{headers:{origin:'https://evil.example'}}),{GCMS_DB:{}});
 assert.equal(result.status,503);
 assert.equal(result.headers.get('access-control-allow-origin'),null);
});

test('CORS preflight admits only the configured GitHub Pages origin',async()=>{
 const base='https://techblogtip-gcms.tamsudev-com.workers.dev';
 const allowed=await handler.fetch(new Request(base+'/api/me',{method:'OPTIONS',headers:{origin:'https://duykhang68.github.io'}}),{});
 assert.equal(allowed.status,204);
 const denied=await handler.fetch(new Request(base+'/api/me',{method:'OPTIONS',headers:{origin:'https://malicious.example'}}),{});
 assert.equal(denied.status,403);
});

test('public content redacts paid/member blocks and staff email',async()=>{
 const sample={id:'1',title:'Secret',visibility:'members',author:'private@example.com',blocks:[{type:'paragraph',text:'not-for-public'}]};
 const database={prepare:()=>({bind:()=>({all:async()=>({results:[{published_json:JSON.stringify(sample),published_at:'2026-11-22T00:00:00.000Z'}]})})})};
 const response=await handler.fetch(new Request('https://techblogtip-gcms.tamsudev-com.workers.dev/api/content/posts'),{GCMS_DB:database});
 assert.equal(response.status,200);
 const entry=(await response.json()).items[0];
 assert.equal(entry.restricted,true);
 assert.deepEqual(entry.blocks,[]);
 assert.equal(Object.hasOwn(entry,'author'),false);
});
test('worker rejects missing credentials without fabricating a session',async()=>{
 const response=await handler.fetch(new Request('https://techblogtip-gcms.tamsudev-com.workers.dev/api/me'),{
  GCMS_DB:{},GCMS_GOOGLE_CLIENT_ID:'123-abc.apps.googleusercontent.com',GCMS_ADMINS:'admin@example.com'
 });
 assert.equal(response.status,401);
});
