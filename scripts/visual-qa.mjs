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
// Visual assertions require completed external CSS loading, not just HTML parsing.
assert.ok(chrome,'Preinstalled Google Chrome/Chromium is required; do not download browsers in CI');
assert.ok(existsSync('dist/index.html'),'Run npm run build before visual QA');
mkdirSync('artifacts/visual-qa',{recursive:true});
const server=spawn(process.execPath,[resolve('node_modules/.bin/astro'),'preview','--host','127.0.0.1','--port','4325'],{stdio:['ignore','pipe','pipe']});
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
  await page.route('**/fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/fonts.gstatic.com/**',route=>route.abort());
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
   const response=await page.goto(base+'/',{waitUntil:'load'});
   assert.equal(response.status(),200);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.locator('.home-intro, .topic-strip').count(),0,'Homepage hero and category strip must be removed');
   assert.equal(await page.locator('.home-search-link').count(),0,'Removed homepage search hero must not return');
   assert.equal(await page.locator('[data-theme-toggle]').count(),1,'Lightbulb theme toggle must be available');
   const cards=await page.locator('.article-card').count();
   assert.equal(cards,8,'Exactly eight homepage article cards required');
   const metric=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
    return {
      scrollWidth:document.documentElement.scrollWidth,
      mainRight:rect('main')?.right??0,
      headerRight:rect('.site-header')?.right??0,
      searchRight:rect('[data-theme-toggle]')?.right??0,
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
   const response=await page.goto(base+'/bai-viet/lam-quen-voi-google-sheets/',{waitUntil:'load'});
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
  // Visual publication regression: story map plus topic-specific diagrams.
  if(w===390 || w===1440){
    try{
      const response=await page.goto(base+'/bai-viet/techblogtip-engineering-rules/',{waitUntil:'load'});
      assert.equal(response.status(),200);
      assert.equal(await page.locator('[data-auto-visualizer]').count(),1,'Missing auto story map');
      assert.equal(await page.locator('.rules-visual').count(),2,'Missing engineering-specific infographics');
      const details=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        mapCards:document.querySelectorAll('[data-auto-visualizer] .map-grid li').length,
        ruleCards:document.querySelectorAll('.rules-grid li').length
      }));
      assert.ok(details.scrollWidth<=w+1,'Engineering article horizontal overflow at '+w+'px');
      assert.ok(details.mapCards>=2,'Visualizer map must include headings');
      assert.equal(details.ruleCards,11,'Engineering visual must cover 11 rules');
      await page.screenshot({path:join('artifacts/visual-qa','engineering-rules-'+w+'.png'),animations:'disabled'});
      console.log('PASS engineering story visual QA '+w+'px');
    }catch(e){record('engineering visual '+w,e);}
  }
  if(w===1440){
    try{
      const response=await page.goto(base+'/bai-viet/hanh-trinh-xay-dung-google-sheets-publisher-techblogtip/',{waitUntil:'load'});
      assert.equal(response.status(),200);
      assert.equal(await page.locator('[data-toc-link]').count(),13,'Publisher article must expose all 13 TOC headings');
      const readProgress=()=>page.locator('[data-reading-progress]').evaluate(node=>Number(node.value));
      const start=await readProgress();
      await page.locator('#article-body h2').nth(5).evaluate(node=>{
        window.scrollTo(0,node.getBoundingClientRect().top+window.scrollY-140);
      });
      await page.waitForFunction(start=>{
        const meter=document.querySelector('[data-reading-progress]');
        return meter&&Number(meter.value)>start&&document.querySelectorAll('[data-toc-link][aria-current="location"]').length===1;
      },start);
      const middle=await readProgress();
      assert.ok(middle>start&&middle<100,'TOC percentage must increase while reading');
      await page.evaluate(()=>{
        const bottom=document.getElementById('article-body').getBoundingClientRect().bottom+window.scrollY;
        window.scrollTo(0,bottom-120);
      });
      await page.waitForFunction(middle=>{
        const meter=document.querySelector('[data-reading-progress]');
        return meter&&Number(meter.value)>middle;
      },middle);
      const end=await readProgress();
      assert.equal(end,100,'Article completion should reach 100%');
      assert.equal(await page.locator('[data-toc-link][aria-current="location"]').getAttribute('href'),await page.locator('[data-toc-link]').last().getAttribute('href'),'Final heading must be active at completion');
      assert.equal(await page.locator('[data-reading-percent]').textContent(),'100%');
      console.log('PASS Smart TOC active section and progress from '+start+'% to '+end+'%');
    }catch(e){record('Smart TOC interaction',e);}
  }
  if(w===390){
    try{
      await page.goto(base+'/tim-kiem/',{waitUntil:'load'});
      await page.locator('#search-input').fill('Google Sheets');
      await page.waitForFunction(()=>document.querySelectorAll('#search-results li').length>0);
      assert.ok((await page.locator('#search-results li').count())>=1,'Search returned no results');
      const url=new URL(page.url());
      assert.equal(url.searchParams.get('q'),'Google Sheets');
      await page.screenshot({path:join('artifacts/visual-qa','search-390.png'),animations:'disabled'});
      await page.goto(base+'/chuyen-muc/',{waitUntil:'load'});
      assert.ok((await page.locator('.directory-item').count())>=4);
      await page.goto(base+'/chu-de/',{waitUntil:'load'});
      assert.ok((await page.locator('.directory-item').count())>=2);
      await page.goto(base+'/the/',{waitUntil:'load'});
      assert.ok((await page.locator('.topic-chips a').count())>=4);
      await page.goto(base+'/',{waitUntil:'load'});
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
 server.stdout.destroy();
 server.stderr.destroy();
}
if(failures.length){console.error(failures.join('\n\n'));process.exitCode=1;}
