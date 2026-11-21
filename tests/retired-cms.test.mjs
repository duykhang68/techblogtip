import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('retired Visual CMS and G-CMS routes, sources and footer entries stay removed',()=>{
 assert.equal(existsSync('public/tools/cms/index.html'),false);
 assert.equal(existsSync('apps/visual-cms'),false);
 assert.equal(existsSync('public/gcms/index.html'),false);
 assert.equal(existsSync('apps/gcms'),false);
 assert.equal(existsSync('scripts/gcms-browser-qa.mjs'),false);
 assert.equal(existsSync('tests/gcms.test.mjs'),false);
 assert.equal(existsSync('tests/gcms-qa-acceptance.test.mjs'),false);
 const footer=readFileSync('src/components/SiteFooter.astro','utf8');
 assert.doesNotMatch(footer,/\/tools\/cms\//);
 assert.doesNotMatch(footer,/>Visual CMS<\/a>/);
 assert.doesNotMatch(footer,/\/gcms\//);
 const sitemap=readFileSync('src/pages/sitemap.xml.ts','utf8');
 assert.doesNotMatch(sitemap,/\/tools\/cms\//);
 assert.doesNotMatch(sitemap,/\/gcms\//);
 const agents=readFileSync('AGENTS.md','utf8');
 assert.match(agents,/Retired \(2026-11-22\)/);
 assert.match(agents,/Retired \(2026-11-22\) G-CMS/);
 const quality=readFileSync('.github/workflows/quality.yml','utf8');
 assert.doesNotMatch(quality,/gcms-browser-qa/);
});
