import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const path='src/pages/editorial-dashboard/index.astro';
const page=readFileSync(path,'utf8');

test('C dashboard is a static, published-content-only Astro route',()=>{
 assert.ok(existsSync(path));
 assert.match(page,/getArticles\(\)/);
 assert.match(page,/const articles: Article\[\]/);
 assert.match(page,/articles\.slice\(0,5\)/);
 assert.doesNotMatch(page,/fetch\(|api\.github\.com|localStorage|setInterval|document\.cookie/);
});
test('C dashboard tracks meaningful editorial metadata rather than fabricated traffic',()=>{
 for(const marker of ['categoryCounts','sourceCounts','tagCounts','seriesCounts','monthlyCounts','withCover','withTags','withSeries','updated'])assert.ok(page.includes(marker),marker);
 assert.match(page,/Không sử dụng dữ liệu truy cập/);
 assert.match(page,/Không tính bản nháp/);
 assert.match(page,/Dữ liệu tại thời điểm build/);
});
test('C dashboard links to canonical public article and taxonomy routes',()=>{
 for(const route of ['articleUrl(article)','categoryUrl(name)','seriesUrl(name)','tagUrl(name)'])assert.ok(page.includes(route),route);
 assert.match(page,/aria-labelledby/);
 assert.match(page,/@media\(max-width:590px\)/);
 assert.match(page,/@media\(prefers-reduced-motion:no-preference\)/);
});
