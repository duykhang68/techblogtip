import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const chrome=[process.env.CHROME_PATH,process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&existsSync(p));
assert.ok(chrome,'Use preinstalled Chrome; do not download a browser');
assert.ok(existsSync('dist/tools/resume/index.html'),'Build Astro before running Resume QA');

const url='http://127.0.0.1:4388';
const server=spawn(process.execPath,[resolve('node_modules/.bin/astro'),'preview','--host','127.0.0.1','--port','4388'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<70;i++){try{const res=await fetch(url+'/tools/resume/');if(res.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}
 assert.ok(ready,'Astro preview failed to start');
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();page.setDefaultTimeout(9000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'text/javascript',body:`
window.__oauthPrompts=0;
window.google={accounts:{oauth2:{
 initTokenClient:({callback})=>({requestAccessToken:()=>{window.__oauthPrompts++;callback({access_token:'test-token',expires_in:3600});}}),
 revoke:(_token,callback)=>callback()
}}};`}));
 let allowDrive=false,uploads=0;
 const folderId='1y0QzF2onlUrVdaQv8I-pu3L8T2d0CE19';
 await page.route('https://www.googleapis.com/**',route=>{
   const req=route.request(), u=new URL(req.url());
   assert.equal(req.headers().authorization,'Bearer test-token','Google access token must authorize Drive API');
   if(u.pathname.endsWith('/'+folderId)){
     return route.fulfill({status:allowDrive?200:403,contentType:'application/json',body:JSON.stringify(allowDrive?{id:folderId,mimeType:'application/vnd.google-apps.folder',trashed:false}:{error:{status:'PERMISSION_DENIED',errors:[{reason:'insufficientPermissions'}]}})});
   }
   if(u.pathname==='/drive/v3/files'&&req.method()==='GET')return route.fulfill({contentType:'application/json',body:JSON.stringify({files:[]})});
   if(u.pathname==='/upload/drive/v3/files'&&req.method()==='POST'){
     uploads++;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'mock-file',version:'1'})});
   }
   return route.fulfill({status:404,contentType:'application/json',body:'{"error":{"status":"NOT_FOUND"}}'});
 });
 await page.goto(url+'/tools/resume/',{waitUntil:'load'});
 await page.locator('#connect-drive').click();
 await page.waitForFunction(()=>document.querySelector('#drive-status')?.textContent?.includes('Đã đăng nhập Google · không thể mở Drive'));
 assert.match(await page.locator('#status').textContent(),/DRIVE_403/);
 assert.equal(await page.locator('#connect-drive').textContent(),'Thử lại kết nối Drive');
 assert.equal(await page.evaluate(()=>window.__oauthPrompts),1,'Google OAuth must be called once');
 assert.equal(await page.locator('#new-resume').isEnabled(),true);
 allowDrive=true;
 await page.locator('#connect-drive').click();
 await page.waitForFunction(()=>document.querySelector('#drive-status')?.textContent?.includes('Drive sẵn sàng'));
 assert.equal(await page.evaluate(()=>window.__oauthPrompts),1,'Retry must reuse valid token, not request consent again');
 assert.equal(await page.locator('#disconnect-drive').isVisible(),true);
 await page.locator('#new-resume').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Đã lưu lên Google Drive'));
 assert.equal(uploads,1,'New CV should upload to Drive');
 assert.equal(await page.evaluate(()=>localStorage.length),0,'Resume contents must not be stored in localStorage');
 assert.deepEqual(errors,[],'No unhandled browser errors');
 console.log('PASS Resume OAuth success -> Drive 403 diagnostic -> retry -> Drive ready -> create and upload');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
