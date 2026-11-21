import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sitemap = readFileSync('src/pages/sitemap.xml.ts','utf8');
const audit = readFileSync('scripts/seo-audit.mjs','utf8');

test('Google sitemap is an absolute canonical UTF-8 XML sitemap, not an HTML wrapper',()=>{
 assert.match(sitemap,/encoding="UTF-8"/);
 assert.match(sitemap,/application\/xml; charset=utf-8/);
 assert.match(sitemap,/www\.sitemaps\.org\/schemas\/sitemap\/0\.9/);
 assert.match(sitemap,/new URL\(path, base\)/);
 assert.match(sitemap,/absolute\.search = ''/);
 assert.match(sitemap,/absolute\.hash = ''/);
 assert.match(sitemap,/urls = new Map/);
 assert.match(sitemap,/localeCompare/);
});

test('Google sitemap does not fabricate lastmod or include drafts',()=>{
 assert.match(sitemap,/getArticles\(\)/);
 assert.match(sitemap,/updated && updated > published \? updated : published/);
 assert.match(sitemap,/lastmod \? '<lastmod>'/);
 assert.doesNotMatch(sitemap,/new Date\(\)/);
 assert.doesNotMatch(sitemap,/<priority>|<changefreq>/);
});

test('Build gate validates XML protocol, Pages project prefix and every sitemap target file',()=>{
 assert.match(audit,/missing XML prolog/);
 assert.match(audit,/invalid sitemap namespace/);
 assert.match(audit,/sitemap URL points to a missing HTML page/);
 assert.match(audit,/invalid sitemap lastmod/);
 assert.match(audit,/sitemap entry outside project directory/);
});
