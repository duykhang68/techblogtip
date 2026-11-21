import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePage,validatePage} from '../apps/visual-cms/src/model.mjs';
import {scopeUser,expandedBlocks,scheduledTick,advancedAPI,spaceFrom} from '../apps/visual-cms/src/enterprise.mjs';
import {graphql,schemaSDL} from '../apps/visual-cms/src/delivery-graphql.mjs';
import CMSHTML from '../apps/visual-cms/src/ui.mjs';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const base='https://techblogtip-visual-cms.tamsudev-com.workers.dev';
const published={id:'a78186b3-6fe1-4921-ae52-a14509975ef7',published_at:'2026-11-21T17:00:00Z',
 published_json:JSON.stringify({title:'Example',slug:'example',locale:'vi',description:'SEO',blocks:[{id:'block-1',type:'heading',props:{text:'Hello'}}]})};
const database={
 prepare(sql){
  return {
   bind(...params){
    return {
     async first(){
      if(sql.includes('FROM cms_spaces'))return params[0]==='default'?{id:'default'}:null;
      if(sql.includes('FROM cms_pages WHERE space_id='))return params[0]==='default'?published:null;
      if(sql.includes('FROM cms_components'))return null;
      if(sql.includes('FROM cms_space_members'))return null;
      return null;
     },
     async all(){
      if(sql.includes('FROM cms_schedules'))return {results:[]};
      if(sql.includes('FROM cms_pages'))return {results:[published]};
      return {results:[]};
     },
     async run(){return {meta:{changes:1}};}
    };
   }
  };
 }
};
test('reusable global block references are validated before storage',()=>{
 const good=normalizePage({title:'Page',slug:'page',blocks:[{id:'id-one',type:'global',props:{componentId:'123e4567-e89b-12d3-a456-426614174000'}}]});
 assert.deepEqual(validatePage(good),[]);
 const bad=normalizePage({title:'Page',slug:'page',blocks:[{id:'id-one',type:'global',props:{componentId:'script:evil'}}]});
 assert.ok(validatePage(bad).includes('global_component_id'));
});
test('workspace membership is scoped and defaults to fail-closed',async()=>{
 const owner={email:'owner@example.org',role:'admin',owner:true,baseRole:'admin'};
 assert.equal((await scopeUser(database,owner,'default')).role,'admin');
 assert.equal(await scopeUser(database,owner,'unknown'),null);
 const reviewer={email:'viewer@example.org',role:'reviewer',owner:false,baseRole:'reviewer'};
 assert.equal((await scopeUser(database,reviewer,'default')).role,'reviewer');
 assert.equal(await scopeUser(database,reviewer,'untrusted'),null);
 assert.equal(spaceFrom(new URL(base+'/api/pages?space=../../secret')),null);
});
test('unavailable global components do not crash published delivery',async()=>{
 const blocks=[{id:'a',type:'paragraph',props:{text:'Safe text'}},{id:'b',type:'global',props:{componentId:'123e4567-e89b-12d3-a456-426614174000'}}];
 const result=await expandedBlocks(database,'default',blocks);
 assert.equal(result.length,1);assert.equal(result[0].props.text,'Safe text');
});
test('read-only GraphQL delivers published content only and rejects fields outside the schema',async()=>{
 const query='{ page(space: "default", locale: "vi", slug: "example") { title blocks { type props { text } } } }';
 const url=new URL(base+'/graphql?query='+encodeURIComponent(query));
 const response=await graphql(new Request(url),url,{CMS_DB:database});
 assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.data.page.title,'Example');
 assert.equal(data.data.page.blocks[0].props.text,'Hello');
 const invalid='{ pages { secret } }';
 const badUrl=new URL(base+'/graphql?query='+encodeURIComponent(invalid));
 const rejected=await graphql(new Request(badUrl),badUrl,{CMS_DB:database});
 assert.equal(rejected.status,400);
 assert.ok(schemaSDL.includes('type Query'));
});
test('scheduler is a no-op when no due jobs are present',async()=>{
 assert.deepEqual(await scheduledTick({CMS_DB:database}),{done:0,failed:0});
});
test('deterministic SEO audit uses no billable model',async()=>{
 const url=new URL(base+'/api/ai/analyze?space=default');
 const actor={email:'admin@example.org',role:'admin',owner:true,baseRole:'admin'};
 const request=new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Short',description:'Tiny',content:'A short article.'})});
 const result=await advancedAPI(request,url,{CMS_DB:database},actor,'default');
 assert.equal(result.status,200);
 const data=await result.json();assert.equal(data.aiGenerated,false);assert.equal(data.report.length,4);
});
test('Visual CMS enterprise console inline JS is valid and mirrored to Pages',()=>{
 const js=CMSHTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);assert.doesNotThrow(()=>new Script(js));
 assert.equal(CMSHTML,readFileSync('public/tools/cms/index.html','utf8'));
 for(const item of ["'globals'","'workflows'","'schedules'","'spaces'","'graphql'","'ai'"])assert.ok(js.includes(item),item);
});
