import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('main routes and SEO endpoints are authored',()=>{
 for(const p of ['src/pages/index.astro','src/pages/bai-viet/[slug].astro','src/pages/chuyen-muc/index.astro','src/pages/the/index.astro','src/pages/chu-de/index.astro','src/pages/tim-kiem/index.astro','src/pages/rss.xml.ts','src/pages/sitemap.xml.ts','src/pages/robots.txt.ts'])assert.ok(existsSync(p),p);
});
test('content and staging policy',()=>{
 const schema=read('src/content.config.ts');
 assert.ok(schema.includes(".endsWith('.webp')"));
 assert.ok(read('src/layouts/BaseLayout.astro').includes('noindex,nofollow'));
 assert.ok(read('src/pages/robots.txt.ts').includes('Disallow: /'));
 assert.ok(read('astro.config.mjs').includes("output: 'static'"));
});
test('staging stays Cloudflare while production is protected GitHub Pages',()=>{
 assert.ok(existsSync('.github/workflows/deploy-staging.yml'));
 const staging=read('.github/workflows/deploy-staging.yml');
 const pages=read('.github/workflows/deploy-production.yml');
 assert.match(staging,/cf deploy/);
 assert.match(staging,/verify-deploy/);
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
 assert.match(deployJob,/reconcile-from-actions\.mjs/);
 assert.match(pages,/branches: \[main\]/);
 assert.doesNotMatch(pages,/cf deploy|CLOUDFLARE_API_TOKEN/);
});

test('demo post slugs are unique, no image format violation',()=>{
 const names=readdirSync('src/content/articles').filter(p=>p.endsWith('.md'));
 assert.ok(names.length>=8);
 assert.equal(new Set(names).size,names.length);
 for(const name of names){
  const data=read('src/content/articles/'+name);
  assert.ok(data.startsWith('---\n'));
  assert.doesNotMatch(data,/!\[[^\]]*\]\([^)]*\.(png|jpg|jpeg)(?:\?|\))/i);
 }
});
test('no GitHub API in public JavaScript',()=>{
 const pages=readdirSync('src/pages/tim-kiem');
 for(const name of pages)assert.doesNotMatch(read('src/pages/tim-kiem/'+name),/api\.github\.com/);
});

test('Cloudflare deploy has a verified nonsecret account fallback', () => {
  const workflow=read('.github/workflows/deploy-staging.yml');
  assert.ok(workflow.includes('secrets.CLOUDFLARE_API_TOKEN'));
  assert.ok(workflow.includes('vars.CLOUDFLARE_ACCOUNT_ID'));
  assert.ok(workflow.includes('d2228e3f75bc47eff64442ad8a225f85'));
  assert.ok(!workflow.includes('secrets.CLOUDFLARE_ACCOUNT_ID'));
});
