import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('main routes and SEO endpoints are authored',()=>{
 for(const p of ['src/pages/index.astro','src/pages/bai-viet/[slug].astro','src/pages/chuyen-muc/index.astro','src/pages/the/index.astro','src/pages/chu-de/index.astro','src/pages/sitemap.xml.ts','src/pages/robots.txt.ts'])assert.ok(existsSync(p),p);
});
test('content and staging policy',()=>{
 const schema=read('src/content.config.ts');
 assert.ok(schema.includes(".endsWith('.webp')"));
 assert.ok(read('src/layouts/BaseLayout.astro').includes('noindex,nofollow'));
 assert.ok(read('src/pages/robots.txt.ts').includes('Disallow: /'));
 assert.ok(read('astro.config.mjs').includes("output: 'static'"));
});
test('retired Cloudflare staging cannot redeploy while production GitHub Pages stays protected',()=>{
 assert.equal(existsSync('.github/workflows/deploy-staging.yml'),false,'retired staging workflow must stay absent');
 const pages=read('.github/workflows/deploy-production.yml');
 assert.match(pages,/name: Deploy · GitHub Pages production/);
 assert.match(pages,/environment:/);
 assert.match(pages,/name: github-pages/);
 assert.match(pages,/DEPLOY_TARGET: github-pages/);
 assert.match(pages,/actions\/configure-pages@/);
 assert.match(pages,/actions\/upload-pages-artifact@/);
 assert.match(pages,/actions\/deploy-pages@/);
 assert.match(pages,/verify-production-deploy/);
 // Build and deploy are separate runners. Deploy must checkout trusted main
 // before executing the script that verifies public release evidence.
 const deployJob=pages.split('\n  deploy:\n')[1];
 assert.ok(deployJob,'missing deploy job');
 assert.match(deployJob,/uses: actions\/checkout@[0-9a-f]{40}/);
 assert.match(deployJob,/ref: \$\{\{ github\.sha \}\}/);
 assert.match(deployJob,/persist-credentials: false/);
 assert.match(deployJob,/git rev-parse HEAD/);
 assert.ok(deployJob.indexOf('actions/checkout@')<deployJob.indexOf('verify-production-deploy.mjs'));
 assert.doesNotMatch(deployJob,/reconcile-from-actions|TBT_PRODUCTION_SYNC_TOKEN/);
 assert.match(pages,/branches: \[main\]/);
 assert.doesNotMatch(pages,/cf deploy|CLOUDFLARE_API_TOKEN/);
});

test('only the four explicitly authorized articles remain, with valid content assets',()=>{
 const names=readdirSync('src/content/articles').filter(p=>p.endsWith('.md'));
 assert.deepEqual(names.sort(), ['lo-trinh-hoc-lap-trinh-ios-tu-con-so-0.md','techblogtip-100-diem-google-pagespeed-insights.md','vibe-code-app-ios-macos-kiem-tien-2026.md','xoa-nhieu-repository-github-cli-an-toan.md']);
 assert.equal(new Set(names).size,names.length);
 for(const name of names){
  const data=read('src/content/articles/'+name);
  assert.ok(data.startsWith('---\n'));
  assert.doesNotMatch(data,/!\[[^\]]*\]\([^)]*\.(png|jpg|jpeg)(?:\?|\))/i);
 }
});
test('new iOS roadmap article provides the full visual interactive learning plan',()=>{
 const article=read('src/content/articles/lo-trinh-hoc-lap-trinh-ios-tu-con-so-0.md');
 const component=read('src/components/IOSRoadmapEnhancer.astro');
 const route=read('src/pages/bai-viet/[slug].astro');
 assert.equal((article.match(/class="iosr-number"/g)||[]).length,9);
 assert.equal((article.match(/data-ios-task=/g)||[]).length,9);
 for(const token of ['iosr-previews','data-ios-roadmap-schedule','The Swift Programming Language','99 USD','Hello, SwiftUI','TestFlight']) assert.ok(article.includes(token),token);
 assert.ok(component.includes('localStorage'));
 assert.ok(route.includes('IOSRoadmapEnhancer'));
});
test('app economics article contains five ideas and self-contained comparison visuals',()=>{
 const article=read('src/content/articles/vibe-code-app-ios-macos-kiem-tien-2026.md');
 const enhancer=read('src/components/AppEconomicsEnhancer.astro');
 const route=read('src/pages/bai-viet/[slug].astro');
 assert.equal((article.match(/^## /gm)||[]).length,8);
 for(const name of ['ReleaseProof','FieldQuote','DocFlow Pro','StoreLaunch QA','Korea Pocket'])assert.ok(article.includes(name),name);
 for(const token of ['econ-ranking','econ-target','data-econ-calc','econ-funnel','RevenueCat','22/11/2026'])assert.ok(article.includes(token),token);
 assert.ok(enhancer.includes('data-econ-calc'));
 assert.ok(enhancer.includes('DOMContentLoaded'));
 assert.ok(route.includes('AppEconomicsEnhancer'));
});
test('retired footer features stay removed',()=>{
 for(const p of ['src/pages/ban-do-kien-thuc/index.astro','src/pages/tim-kiem/index.astro','src/pages/branding/index.astro','src/pages/rss.xml.ts','src/pages/search-index.json.ts'])
  assert.equal(existsSync(p),false,p+' must remain removed');
 const footer=read('src/components/SiteFooter.astro');
 for(const path of ['/ban-do-kien-thuc/','/tim-kiem/','/branding/','/rss.xml'])assert.ok(!footer.includes(path),'retired footer link: '+path);
 assert.ok(footer.includes('/archieve/'),'Archive must remain accessible');
 assert.ok(!footer.includes('/tools/cms/'),'Retired CMS must not be linked from the footer');
 assert.equal(existsSync('public/tools/cms/index.html'),false,'Retired CMS route must remain absent');
 assert.equal(existsSync('apps/visual-cms'),false,'Old CMS source must not be restored accidentally');
 assert.doesNotMatch(read('src/layouts/BaseLayout.astro'),/application\/rss\+xml/);
 assert.doesNotMatch(read('src/pages/404.astro'),/\/tim-kiem\//);
 assert.doesNotMatch(read('src/pages/sitemap.xml.ts'),/ban-do-kien-thuc|tim-kiem/);
});

test('retired deployment cleanup is tightly scoped and cannot delete production',()=>{
 for (const path of [
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-korea-cv-dev.yml',
  '.github/workflows/deploy-publisher-dev.yml',
 ]) assert.equal(existsSync(path),false,path+' must stay retired');
 const cleanup=read('.github/workflows/cleanup-retired-deployments.yml');
 const environmentBlock=cleanup.match(/const environments = \[([\s\S]*?)\];/);
 assert.ok(environmentBlock,'cleanup must have an explicit environment allowlist');
 const names=[...environmentBlock[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
 assert.deepEqual(names,['techblogtip-publisher-dev','techblogtip-korea-cv-dev','techblogtip-staging']);
 assert.match(cleanup,/deployments: write/);
 assert.match(cleanup,/workflow_dispatch:/);
 assert.ok(cleanup.includes("      - '.github/workflows/cleanup-retired-deployments.yml'"),'run on file addition to main');
 assert.doesNotMatch(cleanup,/github\.event\.head_commit\.message/,'cleanup must not depend on merge message');
 assert.match(cleanup,/process\.env\.GITHUB_REF !== 'refs\/heads\/main'/);
 assert.match(cleanup,/deployment\.environment !== environment/);
 assert.match(cleanup,/deployment\.production_environment === true/);
 assert.doesNotMatch(cleanup,/CLOUDFLARE_API_TOKEN|cf deploy|wrangler\s+deploy/);
});
