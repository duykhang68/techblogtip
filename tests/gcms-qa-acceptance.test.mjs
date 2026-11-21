/**
 * G-CMS acceptance-level API tests.
 * Runs entirely in-memory: SQLite D1 adapter, fake R2, locally signed Google ID tokens.
 * No production credentials, production datasets or network calls.
 *
 * CI Node 24: node --test tests/gcms-qa-acceptance.test.mjs
 */
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,sign} from 'node:crypto';
import worker from '../apps/gcms/src/index.mjs';

const ORIGIN='https://techblogtip-gcms.tamsudev-com.workers.dev';
const ALLOWED='https://duykhang68.github.io';
const CLIENT='123456789-qa1234.apps.googleusercontent.com';
const NOW=()=>Math.floor(Date.now()/1000);
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const {privateKey:rogueKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk={...publicKey.export({format:'jwk'}),kid:'qa-key',use:'sig',alg:'RS256'};
const nativeFetch=globalThis.fetch;
before(()=>{
  globalThis.fetch=(url,...args)=>{
    if(String(url)==='https://www.googleapis.com/oauth2/v3/certs')
      return Promise.resolve(new Response(JSON.stringify({keys:[publicJwk]}),{status:200,headers:{'content-type':'application/json'}}));
    return nativeFetch(url,...args);
  };
});
after(()=>{globalThis.fetch=nativeFetch;});
function jwt(email='admin@qa.invalid',extra={},key=privateKey){
  const header={alg:'RS256',typ:'JWT',kid:'qa-key'};
  const payload={
    aud:CLIENT,iss:'https://accounts.google.com',email,email_verified:true,
    iat:NOW()-10,exp:NOW()+600,...extra
  };
  const data=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),key).toString('base64url');
}
class SQLiteD1 {
  constructor(){
    this.db=new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../apps/gcms/migrations/0001_init.sql',import.meta.url),'utf8'));
  }
  prepare(sql){
    const db=this.db;
    return {
      params:[],
      bind(...args){this.params=args;return this;},
      async first(){return db.prepare(sql).get(...this.params)??null;},
      async all(){return {results:db.prepare(sql).all(...this.params)};},
      async run(){const r=db.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}};}
    };
  }
  close(){this.db.close();}
}
class FakeR2 {
  constructor(){this.objects=new Map();}
  async put(key,body,options){this.objects.set(key,{bytes:new Uint8Array(body),contentType:options?.httpMetadata?.contentType});}
  async get(key){
    const value=this.objects.get(key);
    return value?{body:value.bytes,httpMetadata:{contentType:value.contentType}}:null;
  }
}
function fixture(t,options={}){
  const db=new SQLiteD1(),media=new FakeR2();
  t.after(()=>db.close());
  return {db,media,env:{
    GCMS_DB:db,GCMS_MEDIA:options.withoutMedia?undefined:media,
    GCMS_GOOGLE_CLIENT_ID:CLIENT,GCMS_ADMINS:'admin@qa.invalid',
    GCMS_EDITORS:'editor@qa.invalid',GCMS_REVIEWERS:'reviewer@qa.invalid',
    SOURCE_SHA:'gcms-qa-test'
  }};
}
const doc=(overrides={})=>({
  type:'post',title:'QA · Ví dụ có dấu tiếng Việt',slug:'qa-post',
  excerpt:'Bài kiểm tra giả lập',visibility:'public',tags:['QA','Bảo mật'],
  seo:{title:'QA SEO',description:'Test title',canonical:'https://example.org/qa/'},
  blocks:[{type:'heading',text:'Đây là tiêu đề'},{type:'paragraph',text:'Đoạn văn có dấu, emoji 🌿 và ký tự &.'}],
  ...overrides
});
async function call(env,path,method='GET',body=undefined,actor='admin',headers={}){
  const h={origin:ALLOWED,...headers};
  if(actor!==null)h.authorization='Bearer '+jwt((actor==='admin'?'admin':actor==='editor'?'editor':actor==='reviewer'?'reviewer':actor)+'@qa.invalid');
  const hasBody=body!==undefined;
  if(hasBody&&!Object.keys(h).some(x=>x.toLowerCase()==='content-type'))h['content-type']='application/json';
  const payload=hasBody&&typeof body!=='string'&&!(body instanceof Uint8Array)?JSON.stringify(body):body;
  const request=new Request(ORIGIN+path,{method,headers:h,...(hasBody?{body:payload}: {})});
  const response=await worker.fetch(request,env);
  const json=response.headers.get('content-type')?.includes('application/json')?await response.json():null;
  return {status:response.status,json,headers:response.headers,response};
}
async function create(env,overrides={},actor='admin'){
  const result=await call(env,'/api/entries','POST',doc(overrides),actor);
  assert.equal(result.status,201,JSON.stringify(result.json));
  return result.json.entry;
}
const isError=(response,status,code)=>{assert.equal(response.status,status,JSON.stringify(response.json));if(code)assert.equal(response.json.error,code);};

test('health and public config expose no private allowlist',async t=>{
  const {env}=fixture(t);
  let r=await call(env,'/health','GET',undefined,null);
  assert.equal(r.status,200);assert.equal(r.json.configured,true);assert.equal(r.json.media,true);
  assert.equal(r.json.sourceSha,'gcms-qa-test');
  r=await call(env,'/api/config','GET',undefined,null);
  assert.equal(r.json.googleClientId,CLIENT);assert.ok(!JSON.stringify(r.json).includes('admin@qa.invalid'));
  r=await call(env,'/health','GET',undefined,null);
  assert.equal(r.headers.get('cache-control'),'private, no-store');
});

test('CORS preflight allows one GitHub Pages origin and rejects others',async t=>{
  const {env}=fixture(t);
  let r=await call(env,'/api/me','OPTIONS',undefined,null);
  assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),ALLOWED);
  r=await call(env,'/api/me','OPTIONS',undefined,null,{origin:'https://attacker.invalid'});
  assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
});

test('RS256 verification and staff role resolution are real cryptographic checks',async t=>{
  const {env}=fixture(t);
  for(const role of ['admin','editor','reviewer']){
    const r=await call(env,'/api/me','GET',undefined,role);
    assert.equal(r.status,200);
    assert.equal(r.json.role,role);
  }
  for(const extra of [
    {exp:NOW()-1},{aud:'wrong-audience'},{email_verified:false},
    {iss:'https://evil.invalid'},{nbf:NOW()+3600}
  ]){
    const request=new Request(ORIGIN+'/api/me',{headers:{authorization:'Bearer '+jwt('admin@qa.invalid',extra),origin:ALLOWED}});
    const response=await worker.fetch(request,env);
    assert.equal(response.status,401,JSON.stringify(extra));
  }
  const badSig=new Request(ORIGIN+'/api/me',{headers:{authorization:'Bearer '+jwt('admin@qa.invalid',{},rogueKey)}});
  assert.equal((await worker.fetch(badSig,env)).status,401);
  const forbidden=await call(env,'/api/me','GET',undefined,'stranger');
  isError(forbidden,403,'forbidden');
  const noAuth=await call(env,'/api/me','GET',undefined,null);
  isError(noAuth,401,'unauthorized');
});

test('reviewer cannot create; editor can create/update but not publish or delete',async t=>{
  const {env}=fixture(t);
  isError(await call(env,'/api/entries','POST',doc(), 'reviewer'),403,'forbidden');
  const entry=await create(env,{},'editor');
  assert.equal(entry.revision,1);
  isError(await call(env,'/api/entries/'+entry.id+'/publish','POST',undefined,'editor'),403,'forbidden');
  isError(await call(env,'/api/entries/'+entry.id,'DELETE',undefined,'editor'),403,'forbidden');
  const update=await call(env,'/api/entries/'+entry.id,'PUT',{...doc({title:'QA edit'}),revision:1},'editor');
  assert.equal(update.status,200);assert.equal(update.json.entry.revision,2);
  assert.equal(update.json.entry.title,'QA edit');
});

test('draft CRUD, list filtering and persistent SQLite reload',async t=>{
  const {env}=fixture(t);
  const post=await create(env);
  const page=await create(env,{type:'page',slug:'qa-page',title:'QA Page'});
  assert.equal(post.status,'draft');assert.equal(page.type,'page');
  let r=await call(env,'/api/entries?type=post');
  assert.equal(r.json.items.length,1);assert.equal(r.json.items[0].id,post.id);
  r=await call(env,'/api/entries?type=page');
  assert.equal(r.json.items.length,1);
  r=await call(env,'/api/entries/'+post.id);
  assert.deepEqual(r.json.entry.blocks,doc().blocks);
  r=await call(env,'/api/entries?type=invalid');
  isError(r,422,'invalid_type');
  r=await call(env,'/api/stats');
  assert.equal(r.json.posts,1);assert.equal(r.json.pages,1);assert.equal(r.json.drafts,2);
  assert.equal(r.json.published,0);
});

test('duplicate slugs rejected only within same entry type',async t=>{
  const {env}=fixture(t);
  await create(env);
  isError(await call(env,'/api/entries','POST',doc()),409,'slug_already_exists');
  const page=await create(env,{type:'page'});
  assert.equal(page.type,'page');
});

test('stale revision and illegal immutable type never mutate row',async t=>{
  const {env}=fixture(t),entry=await create(env);
  const first=await call(env,'/api/entries/'+entry.id,'PUT',{...doc(),revision:1,title:'Changed'});
  assert.equal(first.status,200);
  isError(await call(env,'/api/entries/'+entry.id,'PUT',{...doc(),revision:1,title:'Stale'}),409,'revision_conflict');
  isError(await call(env,'/api/entries/'+entry.id,'PUT',{...doc({type:'page'}),revision:2}),422,'immutable_type');
  const read=await call(env,'/api/entries/'+entry.id);
  assert.equal(read.json.entry.title,'Changed');assert.equal(read.json.entry.revision,2);
});

test('validation rejects invalid types, slugs, image protocols, empty blocks and XSS canonical',async t=>{
  const {env}=fixture(t);
  for(const [input,expected] of [
    [doc({type:'not-post'}),'invalid_entry_metadata'],
    [doc({slug:'Không hợp lệ'}),'invalid_entry_metadata'],
    [doc({visibility:'root'}),'invalid_entry_metadata'],
    [doc({blocks:[]}), 'empty_content'],
    [doc({blocks:[{type:'script',text:'alert(1)'}]}),'invalid_block'],
    [doc({blocks:[{type:'paragraph',text:''}]}),'empty_block'],
    [doc({blocks:[{type:'image',text:'javascript:alert(1)'}]}),'invalid_image_url'],
    [doc({seo:{canonical:'javascript:alert(1)'}}),'invalid_canonical_url'],
  ]){
    const r=await call(env,'/api/entries','POST',input);
    isError(r,422,expected);
  }
  isError(await call(env,'/api/entries','POST','{invalid-json'),422,'invalid_json');
  const huge=await call(env,'/api/entries','POST',JSON.stringify(doc({excerpt:'x'.repeat(132000)})));
  isError(huge,413,'payload_too_large');
});

test('version snapshots survive edits, restore creates new version; audit captures actions',async t=>{
  const {env}=fixture(t),entry=await create(env);
  let r=await call(env,'/api/entries/'+entry.id,'PUT',{...doc({title:'Version 2'}),revision:1});
  assert.equal(r.json.entry.revision,2);
  r=await call(env,'/api/entries/'+entry.id+'/versions');
  assert.deepEqual(r.json.items.map(x=>x.revision),[2,1]);
  r=await call(env,'/api/entries/'+entry.id+'/restore','POST',{revision:1});
  assert.equal(r.status,200);assert.equal(r.json.entry.revision,3);
  assert.equal(r.json.entry.title,doc().title);
  r=await call(env,'/api/audit');
  assert.ok(r.json.items.some(x=>x.action==='entry.create'));
  assert.ok(r.json.items.some(x=>x.action==='entry.update'));
  assert.ok(r.json.items.some(x=>x.action==='entry.restore'));
  isError(await call(env,'/api/entries/'+entry.id+'/restore','POST',{revision:999}),404,'version_not_found');
});

test('publish creates public snapshot, re-publish reflects updates, unpublish hides it',async t=>{
  const {env}=fixture(t),entry=await create(env);
  let r=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(r.json.items.length,0);
  r=await call(env,'/api/entries/'+entry.id+'/publish','POST');
  assert.equal(r.status,200);assert.equal(r.json.entry.status,'published');
  r=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(r.json.items.length,1);assert.equal(r.json.items[0].title,doc().title);
  assert.deepEqual(r.json.items[0].blocks,doc().blocks);
  assert.equal(Object.hasOwn(r.json.items[0],'author'),false);
  assert.equal(r.headers.get('cache-control'),'public, max-age=60');
  await call(env,'/api/entries/'+entry.id,'PUT',{...doc({title:'Updated draft'}),revision:1});
  r=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(r.json.items[0].title,doc().title,'published content is immutable until re-publish');
  await call(env,'/api/entries/'+entry.id+'/publish','POST');
  r=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(r.json.items[0].title,'Updated draft');
  await call(env,'/api/entries/'+entry.id+'/unpublish','POST');
  r=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(r.json.items.length,0);
});

test('member and paid visibility return teaser only; do not leak restricted body or staff email',async t=>{
  const {env}=fixture(t);
  await create(env,{visibility:'members'});
  await create(env,{slug:'qa-paid',visibility:'paid'});
  const rows=(await call(env,'/api/entries')).json.items;
  for(const row of rows)await call(env,'/api/entries/'+row.id+'/publish','POST');
  const publicResult=await call(env,'/api/content/posts','GET',undefined,null);
  assert.equal(publicResult.json.items.length,2);
  for(const item of publicResult.json.items){
    assert.equal(item.restricted,true);assert.deepEqual(item.blocks,[]);
    assert.equal(Object.hasOwn(item,'author'),false);
    assert.ok(!JSON.stringify(item).includes('Đoạn văn có dấu'));
  }
  isError(await call(env,'/api/content/invalid','GET',undefined,null),404,'not_found');
});

test('schedule validates future and cron publishes due item exactly once',async t=>{
  const {env,db}=fixture(t),entry=await create(env);
  isError(await call(env,'/api/entries/'+entry.id+'/schedule','POST',{scheduledAt:'bad'}),422,'schedule_must_be_future');
  isError(await call(env,'/api/entries/'+entry.id+'/schedule','POST',{scheduledAt:new Date(Date.now()-3000).toISOString()}),422,'schedule_must_be_future');
  const future=new Date(Date.now()+180000).toISOString();
  const scheduled=await call(env,'/api/entries/'+entry.id+'/schedule','POST',{scheduledAt:future});
  assert.equal(scheduled.json.entry.status,'scheduled');
  assert.equal((await call(env,'/api/content/posts','GET',undefined,null)).json.items.length,0);
  // Simulate the passage of time only in the isolated in-memory database.
  db.db.prepare('UPDATE gcms_entries SET scheduled_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),entry.id);
  await worker.scheduled({},env);
  let items=(await call(env,'/api/content/posts','GET',undefined,null)).json.items;
  assert.equal(items.length,1);assert.equal(items[0].status,'published');
  await worker.scheduled({},env);
  items=(await call(env,'/api/content/posts','GET',undefined,null)).json.items;
  assert.equal(items.length,1);
  const rows=(await call(env,'/api/audit')).json.items.filter(x=>x.action==='entry.publish');
  assert.equal(rows.length,1);
});

test('staff member create/list/delete and email uniqueness',async t=>{
  const {env}=fixture(t);
  isError(await call(env,'/api/members','GET',undefined,'reviewer'),403,'forbidden');
  isError(await call(env,'/api/members','POST',{email:'bad'}),422,'invalid_email');
  const r=await call(env,'/api/members','POST',{name:'QA Member',email:'qa.user@example.invalid',labels:['Unit']});
  assert.equal(r.status,201);
  isError(await call(env,'/api/members','POST',{email:'qa.user@example.invalid'}),409,'member_exists');
  const list=await call(env,'/api/members');
  assert.equal(list.json.items.length,1);assert.deepEqual(list.json.items[0].labels,['Unit']);
  await call(env,'/api/members/'+r.json.item.id,'DELETE');
  assert.equal((await call(env,'/api/members')).json.items.length,0);
});

test('newsletter and tier catalog persist without sending emails or charging cards',async t=>{
  const {env}=fixture(t);
  isError(await call(env,'/api/newsletters','POST',{title:''}),422,'title_required');
  isError(await call(env,'/api/tiers','POST',{name:'bad',monthly_cents:-1,yearly_cents:0,currency:'USD'}),422,'invalid_tier');
  isError(await call(env,'/api/newsletters','POST',{title:'QA'},'editor'),403,'forbidden');
  const n=await call(env,'/api/newsletters','POST',{title:'QA Newsletter',description:'Dummy'});
  assert.equal(n.status,201);
  const tier=await call(env,'/api/tiers','POST',{name:'QA Monthly',monthly_cents:490,yearly_cents:4900,currency:'USD'});
  assert.equal(tier.status,201);
  assert.equal((await call(env,'/api/newsletters')).json.items[0].status,'draft');
  assert.equal((await call(env,'/api/tiers')).json.items[0].monthly_cents,490);
  assert.equal((await call(env,'/api/stats')).json.tiers,1);
});

test('R2 upload validates signatures and size; persisted media can be fetched',async t=>{
  const {env,media}=fixture(t);
  const webp=new Uint8Array([82,73,70,70,16,0,0,0,87,69,66,80,86,80,56,32,0,0,0,0]);
  const headers={'content-type':'image/webp','x-file-name':'qa-icon.webp'};
  const res=await call(env,'/api/media','POST',webp,'admin',headers);
  assert.equal(res.status,201,JSON.stringify(res.json));
  const id=res.json.item.id;assert.ok(media.objects.has(id));
  const list=await call(env,'/api/media');
  assert.equal(list.json.items.length,1);
  const request=new Request(ORIGIN+'/media/'+id);
  const image=await worker.fetch(request,env);
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()),webp);
  isError(await call(env,'/api/media','POST',new Uint8Array([1,2,3]),'admin',headers),415,'invalid_media_signature');
  isError(await call(env,'/api/media','POST',webp,'reviewer',headers),403,'forbidden');
  isError(await call(env,'/api/media','POST',webp,'admin',{'content-type':'application/pdf'}),415,'unsupported_media_type');
  const missing=await worker.fetch(new Request(ORIGIN+'/media/00000000-0000-4000-8000-000000000000'),env);
  assert.equal(missing.status,404);
});

test('deletion cascades revisions, public projection and audit persists',async t=>{
  const {env,db}=fixture(t),entry=await create(env);
  await call(env,'/api/entries/'+entry.id+'/publish','POST');
  isError(await call(env,'/api/entries/'+entry.id,'DELETE',undefined,'reviewer'),403,'forbidden');
  assert.equal((await call(env,'/api/entries/'+entry.id,'DELETE')).status,200);
  isError(await call(env,'/api/entries/'+entry.id),404,'not_found');
  assert.equal(db.db.prepare('SELECT count(*) AS n FROM gcms_versions WHERE entry_id=?').get(entry.id).n,0);
  assert.equal((await call(env,'/api/content/posts','GET',undefined,null)).json.items.length,0);
  const audit=(await call(env,'/api/audit')).json.items;
  assert.ok(audit.some(e=>e.action==='entry.delete'&&e.resource_id===entry.id));
});

test('unknown path does not expose internals or allow undeclared methods',async t=>{
  const {env}=fixture(t);
  isError(await call(env,'/api/garbage'),404,'not_found');
  isError(await call(env,'/api/entries','PATCH','{}'),405,'method_not_allowed');
  const payload=await call(env,'/api/garbage');
  assert.equal(payload.headers.get('x-content-type-options'),'nosniff');
  assert.ok(!JSON.stringify(payload.json).includes('GCMS_ADMINS'));
});

test('static admin shell retains noindex and exposes no server credentials',()=>{
  const page=readFileSync(new URL('../public/gcms/index.html',import.meta.url),'utf8');
  assert.match(page,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(page,/sessionStorage/);
  assert.match(page,/techblogtip-gcms\.tamsudev-com\.workers\.dev/);
  assert.doesNotMatch(page,/BEGIN PRIVATE KEY|service_account|stripe_secret|Bearer sk_/i);
  for(const tab of ['overview','posts','pages','media','members','newsletters','tiers','analytics','integrations','settings'])
    assert.ok(page.includes('data-view="'+tab+'"'),tab);
});
