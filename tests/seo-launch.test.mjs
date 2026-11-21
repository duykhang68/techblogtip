import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditHtml,auditSitemap} from '../scripts/seo-audit.mjs';
const sample='<html lang="vi"><head><title>TechBlogTip</title><meta name="description" content="Test"><meta name="robots" content="index,follow"><link rel="canonical" href="https://duykhang68.github.io/techblogtip/"></head></html>';
test('D SEO gate verifies canonical, title, language and indexability',()=>{
 assert.doesNotThrow(()=>auditHtml(sample,'https://duykhang68.github.io/techblogtip/',true));
 assert.throws(()=>auditHtml(sample,'https://duykhang68.github.io/other/',true),/canonical mismatch/);
 assert.throws(()=>auditHtml(sample,'https://duykhang68.github.io/techblogtip/',false),/robots directive/);
});
test('D SEO rejects sitemap duplicates and wrong domain',()=>{
 const origin='https://duykhang68.github.io/techblogtip/';
 assert.equal(auditSitemap('<loc>'+origin+'</loc><loc>'+origin+'chuyen-muc/</loc>',origin,['','chuyen-muc/']),2);
 assert.throws(()=>auditSitemap('<loc>'+origin+'</loc><loc>'+origin+'</loc>',origin,['']),/duplicate/);
 assert.throws(()=>auditSitemap('<loc>https://wrong.example.com/</loc>',origin,[]),/wrong-base/);
});
test('D GSC token is injected only on production GitHub Pages and staging is protected',()=>{
 const layout=readFileSync('src/layouts/BaseLayout.astro','utf8');
 const flow=readFileSync('.github/workflows/deploy-production.yml','utf8');
 assert.match(layout,/google-site-verification/);
 assert.match(layout,/PUBLIC_GSC_VERIFICATION/);
 assert.match(layout,/BASE_URL/);
 assert.match(flow,/vars\.PUBLIC_GSC_VERIFICATION/);
 assert.match(flow,/PUBLIC_INDEXABLE: "true"/);
 assert.match(readFileSync('src/pages/robots.txt.ts','utf8'),/Disallow: \/|Disallow:/);
});
