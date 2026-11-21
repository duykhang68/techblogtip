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
   assert.equal(cards,2,'Homepage should show the two explicitly approved articles');
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
   const response=await page.goto(base+'/bai-viet/techblogtip-100-diem-google-pagespeed-insights/',{waitUntil:'load'});
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
  // Visual publication regression: the retained article must still render its story map.
  if(w===390 || w===1440){
    try{
      const response=await page.goto(base+'/bai-viet/techblogtip-100-diem-google-pagespeed-insights/',{waitUntil:'load'});
      assert.equal(response.status(),200);
      assert.equal(await page.locator('[data-auto-visualizer]').count(),1,'Retained article story map missing');
      const details=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        mapCards:document.querySelectorAll('[data-auto-visualizer] .map-grid li').length,
      }));
      assert.ok(details.scrollWidth<=w+1,'PageSpeed article horizontal overflow at '+w+'px');
      assert.ok(details.mapCards>=2,'PageSpeed story map should include article sections');
      await page.screenshot({path:join('artifacts/visual-qa','pagespeed-100-'+w+'.png'),animations:'disabled'});
      console.log('PASS PageSpeed story visual QA '+w+'px');
    }catch(e){record('PageSpeed visual '+w,e);}
  }
  // New editorial article: original safety-flow diagram must render without horizontal overflow.
  if(w===390 || w===1440){
    try{
      const response=await page.goto(base+'/bai-viet/xoa-nhieu-repository-github-cli-an-toan/',{waitUntil:'load'});
      assert.equal(response.status(),200);
      assert.equal(await page.locator('[data-auto-visualizer]').count(),1,'GitHub CLI article story map missing');
      assert.equal(await page.locator('[data-repo-deletion-flow] .steps li').count(),5,'Five safety checkpoints are required');
      const metrics=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        flowRight:document.querySelector('[data-repo-deletion-flow]').getBoundingClientRect().right
      }));
      assert.ok(metrics.scrollWidth<=w+1,'GitHub CLI article horizontal overflow '+metrics.scrollWidth+' > '+w);
      assert.ok(metrics.flowRight<=w+1,'GitHub CLI illustration clipped on '+w+'px viewport');
      await page.screenshot({path:join('artifacts/visual-qa','github-cli-'+w+'.png'),animations:'disabled'});
      console.log('PASS GitHub CLI safety diagram '+w+'px');
    }catch(e){record('GitHub CLI visual '+w,e);}
  }
  if(w===1440){
    try{
      const response=await page.goto(base+'/bai-viet/techblogtip-100-diem-google-pagespeed-insights/',{waitUntil:'load'});
      assert.equal(response.status(),200);
      assert.ok((await page.locator('[data-toc-link]').count())>=4,'Retained article must expose Smart TOC headings');
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
      // Images and embedded visuals can adjust the document height after load.
      // Wait for a settled end-of-document reading state, not merely the first
      // progress increment (which can legitimately be 99%).
      await page.waitForFunction(() => {
        const root = document.documentElement;
        const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
        if (window.scrollY < maxScroll - 2) {
          window.scrollTo({ top: maxScroll, behavior: 'instant' });
          return false;
        }
        const meter = document.querySelector('[data-reading-progress]');
        const label = document.querySelector('[data-reading-percent]');
        const links = [...document.querySelectorAll('[data-toc-link]')];
        return Number(meter?.value) === 100 &&
          label?.textContent === '100%' &&
          links.length > 0 &&
          links.at(-1)?.getAttribute('aria-current') === 'location';
      }, null, { timeout: 10000 });
      const end = await readProgress();
      assert.equal(end,100,'Article completion should reach 100%');
      assert.equal(await page.locator('[data-toc-link][aria-current="location"]').getAttribute('href'),await page.locator('[data-toc-link]').last().getAttribute('href'),'Final heading must be active at completion');
      assert.equal(await page.locator('[data-reading-percent]').textContent(),'100%');
      console.log('PASS Smart TOC active section and progress from '+start+'% to '+end+'%');
    }catch(e){record('Smart TOC interaction',e);}
  }
  if(w===390){
    try{
      const footerLinks=await page.locator('.site-footer nav a').allTextContents();
      assert.deepEqual(footerLinks.map(s=>s.trim()),['Archive','Sitemap','Visual CMS'],'Footer must link Archive, Sitemap and Visual CMS');
      const cmsHref=await page.locator('.site-footer nav a').last().getAttribute('href');
      assert.match(cmsHref,/^(?:\/techblogtip)?\/tools\/cms\/$/,'Visual CMS footer href must respect the configured base path');
      const cmsResponse=await page.request.get(base+'/tools/cms/');
      assert.equal(cmsResponse.status(),200,'Visual CMS static entry page must load successfully');
      assert.match(await cmsResponse.text(),/<title>Visual CMS/,'Visual CMS entry page title must be present');
      const sitemapResponse=await page.goto(base+'/sitemap/',{waitUntil:'load'});
      assert.equal(sitemapResponse?.status(),200,'HTML sitemap must load successfully');
      assert.equal((await page.locator('#sitemap-title').textContent())?.trim(),'Sitemap');
      assert.ok((await page.locator('.text-sitemap a[href*="/bai-viet/"]').count())>=2,'HTML sitemap must include published articles');
      assert.equal(await page.locator('.text-sitemap img').count(),0,'Sitemap content must remain text-only');
      await page.goto(base+'/chuyen-muc/',{waitUntil:'load'});
      assert.ok((await page.locator('.directory-item').count())>=1);
      await page.goto(base+'/chu-de/',{waitUntil:'load'});
      assert.equal(await page.locator('.directory-item').count(),0,'No old series should be listed');
      await page.goto(base+'/the/',{waitUntil:'load'});
      assert.ok((await page.locator('.topic-chips a').count())>=4);
      await page.goto(base+'/',{waitUntil:'load'});
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('href'),'#content','Keyboard skip link not focusable');
      console.log('PASS categories, series, tags and keyboard skip link');
    }catch(e){record('navigation/keyboard',e);}
    assert.equal(errors.length,0,'Page JavaScript errors: '+errors.join('; '));
  }
  // Korea CV Maker: test actual human-facing controls and readable preview.
  // No Google credentials or applicant information is sent to a live API.
  try{
    const response=await page.goto(base+'/tools/korea-cv/',{waitUntil:'load'});
    assert.equal(response.status(),200);
    assert.equal(await page.locator('#kcv-connect').count(),1);
    assert.equal(await page.locator('#kcv-save').count(),1);
    const metrics=await page.evaluate(()=>{
      const connect=document.querySelector('#kcv-connect');
      const button=getComputedStyle(connect);
      return {
        scrollWidth:document.documentElement.scrollWidth,
        connectHeight:connect.getBoundingClientRect().height,
        connectBackground:button.backgroundColor,
        font:getComputedStyle(document.body).fontFamily,
      };
    });
    assert.ok(metrics.scrollWidth<=w+1,'Korea CV document overflows at '+w+'px ('+metrics.scrollWidth+')');
    assert.ok(metrics.connectHeight>=43,'Google connect touch target too small '+metrics.connectHeight);
    assert.notEqual(metrics.connectBackground,'rgba(0, 0, 0, 0)','Google connection button is unstyled');
    assert.match(metrics.font,/Be Vietnam Pro/,'TechBlogTip typography must be reused');
    assert.ok(await page.locator('.kcv-section-nav a').count()>=6,'Missing quick section navigation');
    await page.locator('[name="targetCompany"]').fill('ABC Visual QA');
    await page.locator('[name="personal.koreanName"]').fill('홍길동');
    await page.locator('#review-input').click();
    await page.locator('#temporary-preview').waitFor({state:'visible'});
    const preview=await page.locator('#temporary-preview').innerText();
    assert.ok(preview.includes('ABC Visual QA')&&preview.includes('홍길동'),'Readable CV preview lost user input');
    assert.equal(await page.locator('#temporary-json').count(),0,'Developer JSON preview should be removed');
    await page.locator('#input-tab').click();
    assert.equal(await page.locator('[name="targetCompany"]').inputValue(),'ABC Visual QA','Returning to edit must preserve data');
    await page.locator('#saved-tab').click();
    assert.equal(await page.locator('#kcv-export-source').inputValue(),'draft','Draft should be default export source');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#kcv-export-xlsx').click();
    const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/\.xlsx$/,'Unsaved draft Excel download missing');
    assert.match(await page.locator('#kcv-export-status').innerText(),/chưa lưu/,'Draft download status must not imply Google Drive save');
    await page.locator('#kcv-export-source').selectOption('saved');
    await page.locator('#kcv-export-xlsx').click();
    assert.match(await page.locator('#kcv-export-status').innerText(),/chọn một CV/,'Saved export without selection needs actionable inline error');
    await page.locator('#kcv-export-source').selectOption('draft');
    assert.equal(await page.locator('#kcv-export-xlsx').isEnabled(),true);
    await page.screenshot({path:join('artifacts/visual-qa','korea-cv-'+w+'.png'),animations:'disabled'});
    console.log('PASS Korea CV human UX '+w+'px');
  }catch(e){record('Korea CV UX '+w,e);}
  await context.close();
 }
 // Network resources from the built artifact must be reachable, without any live APIs.
 for(const endpoint of ['robots.txt','sitemap.xml','release.json']){
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
