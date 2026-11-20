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
test('production deploy is not in milestone A',()=>{
 assert.ok(existsSync('.github/workflows/deploy-staging.yml'));
 assert.ok(!existsSync('.github/workflows/deploy-production.yml'));
 const deploy=read('.github/workflows/deploy-staging.yml');
 assert.match(deploy,/SOURCE_SHA/);assert.match(deploy,/cf deploy/);assert.match(deploy,/verify-deploy/);
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
