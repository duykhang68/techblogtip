// G-CMS browser smoke: isolated mocked Google+API; no production writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
const chrome=[process.env.CHROME_PATH,process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&existsSync(p));
assert.ok(chrome,'Chrome/Chromium is needed for browser QA');
assert.ok(existsSync('dist/gcms/index.html'),'Build G-CMS first');
const origin='http://127.0.0.1:4334';
const apiOrigin='https://techblogtip-gcms.tamsudev-com.workers.dev';
const server=spawn(process.execPath,[resolve('node_modules/.bin/astro'),'preview','--host','127.0.0.1','--port','4334'],{stdio:['ignore','pipe','pipe']});
let logs='';server.stderr.on('data',x=>logs+=String(x));server.stdout.on('data',x=>logs+=String(x));
async function ready(){for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('Astro failed '+logs);try{if((await fetch(origin+'/gcms/')).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Server unavailable '+logs);}
let browser;
const rows=[];
const googleScript="window.google={accounts:{id:{initialize:o=>window.__qa_cb=o.callback,renderButton:el=>{const b=document.createElement('button');b.type='button';b.textContent='QA Google';b.onclick=()=>window.__qa_cb({credential:'mock-qa-token'});el.append(b)},disableAutoSelect:()=>{}}}};";
const ok=(data,status=200)=>({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':origin}});
function mock(request){
 const url=new URL(request.url()),p=url.pathname,m=request.method();
 const body=()=>{try{return JSON.parse(request.postData()||'{}');}catch{return {};}};
 if(p==='/api/config')return ok({googleClientId:'12345-mock.apps.googleusercontent.com',apiBase:apiOrigin});
 if(p==='/api/me')return ok({email:'qa-admin@example.invalid',role:'admin'});
 if(p==='/api/stats')return ok({posts:rows.filter(x=>x.type==='post').length,pages:0,drafts:rows.filter(x=>x.status==='draft').length,scheduled:0,published:rows.filter(x=>x.status==='published').length,members:0,newsletters:0,tiers:0});
 if(p==='/api/entries'){
  if(m==='GET')return ok({items:rows.filter(x=>x.type===(url.searchParams.get('type')||'post'))});
  if(m==='POST'){const e={...body(),id:randomUUID(),status:'draft',revision:1,author:'qa-admin@example.invalid',updatedAt:new Date().toISOString()};rows.unshift(e);return ok({entry:e},201);}
 }
 if(p.startsWith('/api/entries/')){
  const seg=p.split('/'),e=rows.find(x=>x.id===seg[3]);
  if(!e)return ok({error:'not_found'},404);
  if(m==='GET')return ok({entry:e});
  if(m==='PUT'){Object.assign(e,body(),{revision:e.revision+1});return ok({entry:e});}
  if(seg[4]==='publish'){e.status='published';return ok({entry:e});}
  if(seg[4]==='unpublish'){e.status='draft';return ok({entry:e});}
 }
 if(['/api/media','/api/members','/api/newsletters','/api/tiers'].includes(p))return ok({items:[]});
 return ok({error:'qa_unhandled'},404);
}
async function viewport(width,height){
 const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'application/javascript',body:googleScript}));
 await page.route(apiOrigin+'/**',r=>r.fulfill(mock(r.request())));
 assert.equal((await page.goto(origin+'/gcms/',{waitUntil:'load'})).status(),200);
 await page.locator('#signin button').click();
 await page.locator('#app:not([hidden])').waitFor();
 const metrics=await page.evaluate(()=>({body:document.documentElement.scrollWidth,links:document.querySelectorAll('.nav button').length}));
 assert.ok(metrics.body<=width+1,'G-CMS horizontal scroll '+width+': '+metrics.body);
 assert.equal(metrics.links,10);
 await page.locator('[data-view="posts"]').click();
 await page.getByRole('button',{name:'+ Tạo bài viết'}).click();
 await page.locator('#entry-title').fill('QA bài kiểm thử');
 await page.locator('#entry-slug').fill('qa-browser-'+width);
 await page.locator('#block-list textarea').first().fill('Nội dung dummy chỉ tồn tại trong browser QA.');
 await page.getByRole('button',{name:'Tạo bản nháp'}).click();
 await page.getByText('Đã lưu vào cơ sở dữ liệu.').waitFor();
 const saved=rows.find(x=>x.slug==='qa-browser-'+width);
 assert.ok(saved);assert.equal(saved.revision,1);
 await page.reload({waitUntil:'load'});
 await page.locator('#app:not([hidden])').waitFor();
 await page.locator('[data-view="posts"]').click();
 await page.getByText('QA bài kiểm thử').first().waitFor();
 await page.getByRole('button',{name:'Mở'}).first().click();
 await page.locator('#entry-title').fill('QA bài đã sửa '+width);
 await page.getByRole('button',{name:'Lưu thay đổi'}).click();
 await page.getByText('Đã lưu vào cơ sở dữ liệu.').waitFor();
 assert.equal(saved.revision,2);
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
 await page.locator('#entry-status-text').getByText('published',{exact:false}).waitFor();
 assert.equal(saved.status,'published');
 await page.locator('[data-view="analytics"]').click();
 assert.match(await page.locator('#view-body').innerText(),/Chưa triển khai/);
 assert.deepEqual(errors,[]);
 console.log('PASS G-CMS UI mock login, draft, reload, edit, publish, no overflow '+width+'px');
 await ctx.close();
}
try{await ready();browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});await viewport(390,844);await viewport(1440,900);}
finally{await browser?.close();server.kill('SIGTERM');}
