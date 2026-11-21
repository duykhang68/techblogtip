import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('legacy Visual CMS route and standalone Worker source stay removed',()=>{
 assert.equal(existsSync('public/tools/cms/index.html'),false);
 assert.equal(existsSync('apps/visual-cms'),false);
 const footer=readFileSync('src/components/SiteFooter.astro','utf8');
 assert.doesNotMatch(footer,/\/tools\/cms\//);
 assert.doesNotMatch(footer,/>Visual CMS<\/a>/);
 const sitemap=readFileSync('src/pages/sitemap.xml.ts','utf8');
 assert.doesNotMatch(sitemap,/\/tools\/cms\//);
 const agents=readFileSync('AGENTS.md','utf8');
 assert.match(agents,/Retired \(2026-11-22\)/);
});
