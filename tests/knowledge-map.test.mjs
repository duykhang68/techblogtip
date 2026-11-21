import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('Milestone C knowledge map uses public static Astro content only',()=>{
 const path='src/pages/ban-do-kien-thuc/index.astro';
 assert.ok(existsSync(path),'knowledge map route exists');
 const page=readFileSync(path,'utf8');
 assert.match(page,/getArticles\(\)/);
 assert.match(page,/categoryUrl\(category\.name\)/);
 assert.match(page,/tagUrl\(name\)/);
 assert.match(page,/seriesUrl\(name\)/);
 assert.match(page,/articleUrl\(article\)/);
 assert.match(page,/aria-labelledby/);
 assert.match(page,/ordered\.length === 0/);
 assert.doesNotMatch(page,/api\.github\.com|fetch\(|localStorage|setInterval|https:\/\/.*workers\.dev/);
 const footer=readFileSync('src/components/SiteFooter.astro','utf8');
 assert.match(footer,/ban-do-kien-thuc/);
});

test('knowledge map has mobile layout and reduced-motion-safe movement',()=>{
 const page=readFileSync('src/pages/ban-do-kien-thuc/index.astro','utf8');
 assert.match(page,/@media\(max-width:600px\)/);
 assert.match(page,/@media\(prefers-reduced-motion:no-preference\)/);
 assert.match(page,/grid-template-columns:1fr/);
});
