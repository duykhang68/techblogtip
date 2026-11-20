import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

let base='http://127.0.0.1:4325';
const screens=[360,390,430,768,1440];
const sizes={360:[360,780],390:[390,844],430:[430,932],768:[768,1024],1440:[1440,900]};
const browserPaths=[process.env.CHROME_PATH,process.env.CHROME_BIN,
 '/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
 '/usr/bin/chromium','/usr/bin/chromium-browser'
].filter(Boolean);
const chrome=browserPaths.find(p=>existsSync(p));
assert.ok(chrome,'Preinstalled Google Chrome/Chromium is required; do not download browsers in CI');
assert.ok(existsSync('dist/index.html'),'Run npm run build before visual QA');
mkdirSync('artifacts/visual-qa',{recursive:true});
const server=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','preview','--','--port','4325'],{stdio:['ignore','pipe','pipe']});
let serverLog='';
server.stdout.on('data',chunk=>serverLog+=chunk.toString());
server.stderr.on('data',chunk=>serverLog+=chunk.toString());
async function waitForServer(){
 let lastError='';
 const candidates=['http://127.0.0.1:4325','http://localhost:4325','http://[::1]:4325'];
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)throw new Error('Astro preview exited: '+serverLog);
  for(const url of candidates){
   try{
    const response=await fetch(url+'/',{signal:AbortSignal.timeout(2000)});
    if(response.ok){base=url;console.log('QA server ready at '+base);return;}
    lastError=url+' HTTP '+response.status;
   }catch(e){lastError=url+' '+e.message+(e.cause?' / '+e.cause.message:'');}
  }
  await new Promise(r=>setTimeout(r,250));
 }
 throw new Error('Astro preview unavailable. Last error: '+lastError+'\n'+serverLog);
}
let browser;
const failures=[];
const record=(label,error)=>{failures.push(label+': '+(error?.stack||String(error)));console.error('FAIL '+label,error.message||error);};
function verifyViewportMetrics(m,width,label){
 assert.ok(m.scrollWidth<=width+1, label+': document horizontal overflow '+m.scrollWidth+' > '+width);
 assert.ok(m.mainRight<=width+1,label+': main clipped at '+m.mainRight+' > '+width);
 assert.ok(m.headerRight<=width+1,label+': header clipped at '+m.headerRight+' > '+width);
 assert.ok(m.searchRight<=width+1,label+': search field clipped at '+m.searchRight+' > '+width);
}
try{
 await waitForServer();
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of screens){
  const [w,h]=sizes[width];
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  page.setDefaultTimeout(9000);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
   const response=await page.goto(base+'/',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   assert.equal(await page.locator('h1').count(),1);
   const cards=await page.locator('.article-card').count();
   assert.equal(cards,8,'Exactly eight homepage article cards required');
   const metric=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
    return {
      scrollWidth:document.documentElement.scrollWidth,
      mainRight:rect('main')?.right??0,
      headerRight:rect('.site-header')?.right??0,
      searchRight:rect('.home-search-link')?.right??0,
      articleStart:rect('.article-card')?.top??Infinity,
      columns:getComputedStyle(document.querySelector('.article-grid')).gridTemplateColumns.split(' ').filter(Boolean).length
    };
   });
   verifyViewportMetrics(metric,w,'home '+w);
   assert.equal(metric.columns,w<=520?1:w<=860?2:w<=1180?3:4,'Homepage grid columns '+w);
   if(w<=430)assert.ok(metric.articleStart<h,'First article card must appear above fold on '+w+'px viewport; got y='+metric.articleStart);
   await page.screenshot({path:join('artifacts/visual-qa','home-'+w+'.png'),animations:'disabled'});
   console.log('PASS homepage '+w+'px; first card y='+Math.round(metric.articleStart)+'; columns='+metric.columns);
  }catch(e){record('homepage '+w,e);}
  try{
   const response=await page.goto(base+'/bai-viet/lam-quen-voi-google-sheets/',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   assert.equal(await page.locator('.prose h2').count()>0,true,'Article heading missing');
   const state=await page.evaluate(()=>({
     scrollWidth:document.documentElement.scrollWidth,
     mainRight:document.querySelector('main').getBoundingClientRect().right,
     headerRight:document.querySelector('.site-header').getBoundingClientRect().right,
     tocVisible: !!document.querySelector('.article-aside')&&getComputedStyle(document.querySelector('.article-aside')).display!=='none',
   }));
   assert.ok(state.scrollWidth<=w+1,'Article horizontal overflow '+state.scrollWidth+' > '+w);
   assert.ok(state.mainRight<=w+1,'Article clipped');
   assert.equal(state.tocVisible,w>860,'TOC visibility does not match responsive spec at '+w);
   await page.screenshot({path:join('artifacts/visual-qa','article-'+w+'.png'),animations:'disabled'});
   console.log('PASS article '+w+'px');
  }catch(e){record('article '+w,e);}
  if(w===390){
    try{
      await page.goto(base+'/tim-kiem/',{waitUntil:'domcontentloaded'});
      await page.locator('#search-input').fill('Google Sheets');
      await page.waitForFunction(()=>document.querySelectorAll('#search-results li').length>0);
      assert.ok((await page.locator('#search-results li').count())>=1,'Search returned no results');
      const url=new URL(page.url());
      assert.equal(url.searchParams.get('q'),'Google Sheets');
      await page.screenshot({path:join('artifacts/visual-qa','search-390.png'),animations:'disabled'});
      await page.goto(base+'/chuyen-muc/',{waitUntil:'domcontentloaded'});
      assert.ok((await page.locator('.directory-item').count())>=4);
      await page.goto(base+'/chu-de/',{waitUntil:'domcontentloaded'});
      assert.ok((await page.locator('.directory-item').count())>=2);
      await page.goto(base+'/the/',{waitUntil:'domcontentloaded'});
      assert.ok((await page.locator('.topic-chips a').count())>=4);
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('href'),'#content','Keyboard skip link not focusable');
      console.log('PASS search, categories, series, tags and keyboard skip link');
    }catch(e){record('search/navigation/keyboard',e);}
    assert.equal(errors.length,0,'Page JavaScript errors: '+errors.join('; '));
  }
  await context.close();
 }
 // Network resources from the built artifact must be reachable, without any live APIs.
 for(const endpoint of ['robots.txt','rss.xml','sitemap.xml','search-index.json','release.json']){
  const response=await fetch(base+'/'+endpoint);
  assert.equal(response.status,200,endpoint+' failed');
 }
 console.log('Visual QA complete: '+screens.join(', ')+'px');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
if(failures.length){console.error(failures.join('\n\n'));process.exitCode=1;}
