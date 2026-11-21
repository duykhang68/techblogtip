import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const path='src/pages/ban-do-kien-thuc/index.astro';
const page=()=>readFileSync(path,'utf8');

test('knowledge explorer derives graph only from published Astro content',()=>{
 assert.ok(existsSync(path),'knowledge map route exists');
 const source=page();
 assert.match(source,/getArticles\(\)/);
 assert.match(source,/categoryUrl\(category\.name\)/);
 assert.match(source,/tagUrl\(name\)/);
 assert.match(source,/seriesUrl\(name\)/);
 assert.match(source,/articleUrl\(article\)/);
 assert.match(source,/edges: articles\.flatMap/);
 assert.match(source,/JSON\.stringify\(graph\)/);
 assert.match(source,/aria-labelledby/);
 assert.match(source,/ordered\.length === 0/);
 assert.doesNotMatch(source,/api\.github\.com|fetch\(|localStorage|setInterval|https:\/\/.*workers\.dev/);
 const footer=readFileSync('src/components/SiteFooter.astro','utf8');
 assert.match(footer,/ban-do-kien-thuc/);
});

test('knowledge explorer has responsive sidebar, visible details, mobile controls and reduced-motion-safe movement',()=>{
 const source=page();
 assert.match(source,/@media\(max-width:600px\)/);
 assert.match(source,/\.km-app\{display:block/);
 assert.match(source,/\.km-category-list\{flex-direction:row;overflow:auto/);
 assert.match(source,/\.km-graph-wrap,\.km-graph-wrap svg\{min-height:400px/);
 assert.match(source,/@media\(prefers-reduced-motion:no-preference\)/);
 assert.match(source,/id="km-zoom-in"/);
 assert.match(source,/id="km-zoom-out"/);
 assert.match(source,/id="km-detail"/);
 assert.match(source,/aria-live="polite"/);
 assert.match(source,/g\.addEventListener\('keydown'/);
});
