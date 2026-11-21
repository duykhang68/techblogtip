// Isolated real-browser acceptance of the ACTUAL Publisher HTML, JavaScript and
// CSS. All Google OAuth/Sheet/GitHub responses are synthetic, in memory.
// NEVER point this runner at a deployed Worker or a real Google account.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from '../../workers/publisher/src/ui.mjs';
import { EDITOR_HTML, EDITOR_JS, EDITOR_CSS, EDITOR_IMPORT_CSS, EDITOR_WORKSPACE_CSS } from '../../workers/publisher/src/editor-ui.mjs';
import { PRODUCTION_HTML, PRODUCTION_JS, PRODUCTION_CSS } from '../../workers/publisher/src/production-ui.mjs';
import { parsePublisherPreview } from '../../workers/publisher/src/markdown-preview.mjs';\nimport { STUDIO_EDITOR_JS,STUDIO_CSS } from '../../workers/publisher/src/studio-v2.mjs';

const paths=[process.env.CHROME_PATH,process.env.CHROME_BIN,
  '/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
  '/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const chrome=paths.find(existsSync);
assert.ok(chrome,'Preinstalled Chrome/Chromium required; never download a browser');
const fakeId='TBT-browser-fixture-2026';
const fakeUrl='https://github.com/duykhang68/techblogtip/pull/99999';
const revision='a'.repeat(64);
const sampleBody=[
  '## Hành trình phát hành',
  '',
  'Bài có **chữ đậm**, [liên kết](https://duykhang68.github.io/techblogtip/), và mã.',
  '',
  '| Bước | Trạng thái |',
  '| --- | --- |',
  '| Google Sheets | READY |',
  '| Draft PR | Chờ duyệt |',
  '',
  '```js',
  'const proof = "public SHA";',
  '```',
  '',
  '<script>window.__publisherInjected = true</script>'
].join('\n');
const draft={
  rowNumber:2,sourceId:'TBT-browser-draft-2026',title:'Bản nháp xem trước',
  body:sampleBody,author:'Synthetic Editorial Tester',
  category:'Engineering',tags:'Sheets, UI',summary:'Bản nháp để kiểm thử trình duyệt',
  series:'Publisher Acceptance',status:'DRAFT',slug:'ban-nhap-xem-truoc',
  sourceHash:'',draftPr:'',publishedUrl:'',releaseSha:'',publishedAt:''
};
const ready={
  ...draft,rowNumber:3,sourceId:fakeId,title:'Bài READY kiểm thử gửi một lần',
  status:'READY',slug:'bai-ready-trong-trinh-duyet'
};
const rows=[draft,ready];
const mediaItems=[];
const mediaFilename='b'.repeat(32)+'.webp';
const metrics={signIns:0,submit:0,preview:0,putDraft:0,revision:0,unexpected:[]};
const expectedFields=['title','body','author','category','tags','summary','series','slug'];
const json=(res,obj,status=200,headers={})=>{
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',...headers});res.end(JSON.stringify(obj));
};
const text=(res,body,type)=>{res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(body);};
const bodyOf=async request=>{
 let raw='';for await(const chunk of request){
  raw+=chunk.toString();
  if(raw.length>125000)throw new Error('unexpectedly-large-browser-fixture-request');
 }
 return raw?JSON.parse(raw):{};
};
const html=ADMIN_HTML.replace('__GOOGLE_CLIENT_ID__','synthetic-browser-test-client')
  .replace('</main>',PRODUCTION_HTML+'</main>')
  .replace('</body>','<script src="/production-status.js" defer></script></body>');
const editorHtml='<!doctype html><html lang="vi"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Editor · TechBlogTip</title><link rel="stylesheet" href="/admin.css"></head>'+
  '<body class="editor-workspace"><header class="editor-workspace-header">'+
  '<a href="/admin">← Hàng đợi bài viết</a></header>'+
  '<main class="editor-workspace-main">'+EDITOR_HTML+'</main>'+
  '<script src="/editor.js" defer></script></body></html>';
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const route=url.pathname,auth=(req.headers.cookie||'').includes('publisher_fixture_session=1');
  try{
   if(req.method==='GET'&&route==='/admin')return text(res,html,'text/html; charset=utf-8');
    if(req.method==='GET'&&route==='/editor')return text(res,editorHtml,'text/html; charset=utf-8');
   if(req.method==='GET'&&route==='/admin.js')return text(res,ADMIN_JS,'application/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/editor.js')return text(res,EDITOR_JS+STUDIO_EDITOR_JS,'application/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/production-status.js')return text(res,PRODUCTION_JS,'application/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/admin.css')return text(res,ADMIN_CSS+EDITOR_CSS+EDITOR_IMPORT_CSS+EDITOR_WORKSPACE_CSS+PRODUCTION_CSS+STUDIO_CSS,'text/css; charset=utf-8');
   if(route==='/api/session'&&req.method==='POST'){
    const b=await bodyOf(req);
    if(b.credential!=='synthetic-browser-credential')return json(res,{message:'Invalid fixture credential'},401);
    metrics.signIns++;
    return json(res,{editor:'synthetic@example.test'},200,{'set-cookie':'publisher_fixture_session=1; Path=/; HttpOnly; SameSite=Lax'});
   }
   if(route==='/api/session'&&req.method==='GET')
    return auth?json(res,{editor:'synthetic@example.test'}):json(res,{message:'Not authenticated'},401);
   if(route==='/api/session'&&req.method==='DELETE')
    return json(res,{ok:true},200,{'set-cookie':'publisher_fixture_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'});
   if(!auth&&route.startsWith('/api/'))return json(res,{message:'Not authenticated'},401);
   if(req.method==='GET'&&route==='/api/rows')
    return json(res,{editor:'synthetic@example.test',rows});
   if(req.method==='GET'&&route==='/api/drive/thumb'){
    res.writeHead(200,{'Content-Type':'image/webp'});res.end(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64'));return;
   }
   if(req.method==='GET'&&route==='/api/drive/files')
    return json(res,{files:[
     {id:'drive-image-001',name:'photo.jpg',mimeType:'image/jpeg',size:30000},
     {id:'drive-image-002',name:'photo.png',mimeType:'image/png',size:44000},
     {id:'drive-image-003',name:'photo.webp',mimeType:'image/webp',size:16000}]});
   if(req.method==='POST'&&route==='/api/media/import'){
    const input=await bodyOf(req);
    assert.equal(input.sourceId,draft.sourceId);
    assert.deepEqual(input.fileIds,['drive-image-001','drive-image-002','drive-image-003']);
    const asset={filename:mediaFilename,path:'/techblogtip/media/tbt-'+'a'.repeat(16)+'/'+mediaFilename,
      preview:'/api/media/'+draft.sourceId+'/'+mediaFilename,bytes:16000};
    if(!mediaItems.length)mediaItems.push(asset);
    return json(res,{items:[asset]});
   }
   if(req.method==='GET'&&route.startsWith('/api/media/')){
    res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private'});
    res.end(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64'));return;
   }
   if(req.method==='GET'&&route==='/api/media-library')return json(res,{sourceId:url.searchParams.get('sourceId'),items:mediaItems});
   if(req.method==='GET'&&route==='/api/draft'){
    const row=rows.find(r=>r.sourceId===url.searchParams.get('sourceId'));
    if(!row||row.status!=='DRAFT')return json(res,{message:'Draft unavailable'},409);
    return json(res,{status:'DRAFT',snapshot:'fixture-snapshot',
      fields:Object.fromEntries(expectedFields.map(key=>[key,row[key]]))});
   }
   if(req.method==='PUT'&&route==='/api/draft'){
    const input=await bodyOf(req);
    assert.equal(input.sourceId,draft.sourceId);
    assert.match(input.fields.body,/!\[Ảnh nghiệm thu P8\]\(\/techblogtip\/media\/tbt-[a-f0-9]{16}\/[a-f0-9]{32}\.webp\)/);
    draft.body=input.fields.body;metrics.putDraft++;
    return json(res,{saved:true,snapshot:'fixture-snapshot',fields:input.fields});
   }
   if(req.method==='POST'&&route==='/api/preview'){
    metrics.preview++;
    const b=await bodyOf(req);
    return json(res,parsePublisherPreview(b.body));
   }
   if(req.method==='GET'&&route==='/api/revision'){
    metrics.revision++;
    return json(res,{sourceRevision:revision});
   }
   if(req.method==='POST'&&route==='/api/submit'){
    const b=await bodyOf(req);metrics.submit++;
    if(b.sourceId!==fakeId||b.sourceRevision!==revision)return json(res,{message:'Source mismatch'},409);
    // A tiny delay exposes overlapping double-clicks in the ACTUAL UI.
    await new Promise(resolve=>setTimeout(resolve,130));
    if(ready.draftPr)return json(res,{prUrl:fakeUrl,created:false,review:'draft',published:false});
    ready.draftPr=fakeUrl;ready.sourceHash=revision;
    return json(res,{prUrl:fakeUrl,created:true,review:'draft',published:false},201);
   }
   if(req.method==='GET'&&route==='/api/production-status')
    return json(res,{status:'fixture',queue:[],releases:[]});
   if(req.method==='GET'&&route==='/api/pr-status')
    return json(res,{stage:'draft',headSha:'b'.repeat(40),checks:[]});
   if(req.method==='GET'&&route==='/api/validate')
    return json(res,{valid:true,sourceId:url.searchParams.get('sourceId')});
   if(req.method==='GET'&&route==='/api/preflight')
    return json(res,{sheet:{ok:true,rows:2},github:{ok:true}});
   if(route==='/favicon.ico'){res.writeHead(204);return res.end();}
   if(route.startsWith('/api/'))metrics.unexpected.push(req.method+' '+route);
   return json(res,{message:'Fixture endpoint not available'},404);
  }catch(error){return json(res,{message:error.message},500);}
});
const screenshotPath='artifacts/visual-qa';
mkdirSync(screenshotPath,{recursive:true});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:chrome,headless:true,
   args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   window.google={accounts:{id:{
    initialize(config){window.__fixtureGoogleCallback=config.callback;},
    renderButton(element){
     const button=document.createElement('button');button.id='mock-google-login';
     button.textContent='Synthetic Google login (test only)';
     button.addEventListener('click',()=>window.__fixtureGoogleCallback({credential:'synthetic-browser-credential'}));
     element.append(button);
    },
    disableAutoSelect(){}
   }}};
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,
    contentType:'application/javascript',body:'/* mocked Google Identity script */'}));
  await page.route('https://**/*',r=>r.abort('blockedbyclient'));
  let response=await page.goto(base+'/admin',{waitUntil:'load'});
  assert.equal(response.status(),200);
  await page.locator('#mock-google-login').waitFor();
  assert.equal(await page.locator('.row').count(),0,'Anonymous editor must not expose Sheet data');
  await page.locator('#mock-google-login').click();
  await page.waitForFunction(()=>document.querySelector('#account')?.textContent.includes('synthetic@example.test'));
  await page.waitForFunction(()=>document.querySelectorAll('.row').length===2);
  const draftCard=page.locator('article.row').filter({hasText:'Bản nháp xem trước'});
  assert.equal(await page.locator('#editor-panel').count(),0,
    'Editor must not be embedded underneath the admin queue');
  const popupPromise=context.waitForEvent('page');
  await draftCard.getByRole('button',{name:'Sửa trực quan'}).click();
  const editor=await popupPromise;
  await editor.waitForLoadState('load');
  assert.equal(new URL(editor.url()).pathname,'/editor','Editor must open in a separate tab');
  assert.equal(new URL(editor.url()).searchParams.get('sourceId'),draft.sourceId);
  assert.equal(await editor.locator('#editor-panel').count(),1);
  const previewButton=editor.locator('#editor-preview-toggle');
  // The new tab must reuse the existing session cookie for protected draft data.
  await editor.waitForFunction(()=>document.querySelector('#editor-preview-toggle')?.disabled===false);
  await editor.waitForFunction(()=>document.querySelector('.studio-status')?.textContent.includes('Bài đã khóa'));
  assert.equal(await editor.locator('.studio-retry').isHidden(),true,'Healthy draft must not show retry action');
  assert.equal(await previewButton.isDisabled(),false);
  assert.equal(await editor.locator('#editor-body').getAttribute('contenteditable'),'false',
    'Advanced Markdown must remain read-only in visual editor');
  await previewButton.click();
  await editor.waitForFunction(()=>document.querySelector('#editor-preview-status')?.textContent.includes('Bản xem trước chỉ đọc'));
  assert.ok(await editor.locator('#editor-preview-content table').count()>0,'Markdown table missing');
  assert.ok(await editor.locator('#editor-preview-content pre').count()>0,'Code block missing');
  assert.equal(await editor.evaluate(()=>window.__publisherInjected),undefined,'Preview ran untrusted script');
  assert.equal(await editor.locator('#editor-preview-content script').count(),0,'Unsafe script element created');
  assert.equal(await editor.locator('#editor-save').isDisabled(),false,
    'Advanced Markdown must allow safe media-only append while its text stays read-only');
  await editor.screenshot({path:join(screenshotPath,'publisher-editor-preview-'+width+'.png'),fullPage:true,animations:'disabled'});
  // A direct reload must restore the same workspace using URL and session.
  await editor.reload({waitUntil:'load'});
  await editor.waitForFunction(()=>document.querySelector('#editor-preview-toggle')?.disabled===false);
  assert.equal(await editor.locator('#editor-body').getAttribute('contenteditable'),'false');
  await editor.locator('#editor-close').click();
  await editor.waitForURL('**/admin');
  await editor.close();
  if(width===390){
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=1,'Publisher mobile horizontal overflow '+overflow);
  }
  const readyCard=page.locator('article.row').filter({hasText:'Bài READY kiểm thử gửi một lần'});
  if(width===390){
   await page.evaluate(()=>{
    const card=[...document.querySelectorAll('article.row')].find(c=>c.textContent.includes('Bài READY kiểm thử gửi một lần'));
    const button=[...card.querySelectorAll('button')].find(b=>b.textContent.includes('Tạo Draft PR'));
    button.click();button.click();
   });
   await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Đã tạo Draft PR'));
   assert.equal(metrics.submit,1,'Double click caused duplicate POST /api/submit');
   assert.equal(await readyCard.getByRole('button',{name:'Tạo Draft PR'}).count(),0);
   assert.equal(await readyCard.getByRole('link',{name:'Mở Draft PR'}).getAttribute('href'),fakeUrl);
   await page.reload({waitUntil:'load'});
   await page.waitForFunction(()=>document.querySelector('#account')?.textContent.includes('synthetic@example.test'));
   await page.waitForFunction(()=>document.querySelectorAll('.row').length===2);
   assert.equal(await page.locator('#mock-google-login').isVisible(),false,
     'Cookie session must survive reload without requesting sign-in');
   assert.equal(await page.locator('article.row').filter({hasText:'Bài READY kiểm thử gửi một lần'})
      .getByRole('button',{name:'Tạo Draft PR'}).count(),0,'Reload may not re-enable create PR');
  }else{
   assert.equal(await readyCard.getByRole('button',{name:'Tạo Draft PR'}).count(),0,
     'Existing PR must not expose create action on another viewport/session');
  }
  assert.deepEqual([draft.publishedUrl,draft.releaseSha,draft.publishedAt,
    ready.publishedUrl,ready.releaseSha,ready.publishedAt],['','','','','',''],
    'Browser fixture unexpectedly altered M:O metadata');
  assert.equal(metrics.putDraft,0);
  assert.deepEqual(errors,[],'Browser console exception: '+errors.join('; '));
  await context.close();
  console.log('PASS synthetic Google-session browser UI at '+width+'px: preview, read-only advanced Markdown, safe submit/reload');
 }
 // P8 real browser exercise: multi-select, import, insert, save and reopen using local fakes only.
 draft.body='## Bài P8\n\nBài viết nhập ảnh dùng kiểm thử trực quan.';
 const mediaContext=await browser.newContext({viewport:{width:1280,height:900}});
 await mediaContext.addCookies([{name:'publisher_fixture_session',value:'1',url:base}]);
 const mediaPage=await mediaContext.newPage();
 await mediaPage.goto(base+'/editor?sourceId='+draft.sourceId,{waitUntil:'load'});
 await mediaPage.waitForFunction(()=>document.querySelector('#editor-body')?.getAttribute('contenteditable')==='true');
 await mediaPage.locator('#import-drive').click();
 await mediaPage.locator('#drive-file-grid input[type="checkbox"]').first().waitFor();
 assert.equal(await mediaPage.locator('#drive-file-grid input[type="checkbox"]').count(),3);
 for(const choice of await mediaPage.locator('#drive-file-grid input[type="checkbox"]').all())await choice.check();
 await mediaPage.locator('#drive-import-selected').click();
 await mediaPage.locator('#media-library-grid button').first().waitFor();
 await mediaPage.locator('#media-library-grid input[aria-label^="Mô tả ảnh"]').first().fill('Ảnh nghiệm thu P8');
 await mediaPage.locator('#media-library-grid button').first().click();
 assert.equal(await mediaPage.locator('#editor-body figure[data-media-path] img').count(),1);
 assert.equal(await mediaPage.locator('#editor-body figure[data-media-path] img').first().getAttribute('alt'),'Ảnh nghiệm thu P8');
 assert.match(await mediaPage.locator('#editor-import-status').textContent()||'',/Đã chèn ảnh/);
 await mediaPage.locator('#drive-import-selected').click();
 await mediaPage.waitForFunction(()=>document.querySelector('#editor-import-status')?.textContent.includes('Đã nhập 1 WebP'));
 assert.equal(await mediaPage.locator('#media-library-grid .drive-tile').count(),1,'Repeated import duplicated media');
 await mediaPage.locator('#editor-save').click();
 await mediaPage.waitForFunction(()=>document.querySelector('#editor-save-status')?.textContent.includes('Đã lưu Google Sheets.'));
 assert.equal(metrics.putDraft,1);
 await mediaPage.reload({waitUntil:'load'});
 await mediaPage.waitForFunction(()=>document.querySelector('#editor-body figure[data-media-path] img')!==null);
 assert.equal(await mediaPage.locator('#editor-body figure[data-media-path] img').count(),1,'Stored WebP did not survive reload');
 await mediaContext.close();
 console.log('PASS P8 synthetic browser batch picker → WebP library → WYSIWYG insert → Sheet save → reopen');
 assert.equal(metrics.submit,1,'Expected exactly one synthetic submit across both viewports');
 assert.ok(metrics.preview>=2,'Expected preview request on mobile and desktop');
 assert.deepEqual(metrics.unexpected,[],'Unexpected synthetic endpoint');
 console.log('PASS isolated Playwright publisher browser acceptance; no real Google, GitHub or Sheets APIs contacted');
}finally{
 if(browser)await browser.close();
 if(server.listening)await new Promise(resolve=>server.close(resolve));
}
