import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('HTML sitemap is a compact text-only, accessible, SEO-friendly static page', () => {
  const path = 'src/pages/sitemap/index.astro';
  assert.ok(existsSync(path), 'HTML sitemap route must exist');
  const page = read(path);
  assert.match(page, /<BaseLayout[\s\S]*canonicalPath=\{withBase\('\/sitemap\/'\)\}/);
  assert.match(page, /<h1 id="sitemap-title">Sitemap<\/h1>/);
  assert.match(page, /<nav aria-label="Sơ đồ cấu trúc website TechBlogTip"/);
  assert.match(page, /<a href=\{withBase\('\/sitemap\.xml'\)\}>XML sitemap<\/a>/);
  assert.doesNotMatch(page, /<img\b|<picture\b|<video\b|<canvas\b/i);
  assert.doesNotMatch(page, /fetch\(|setInterval\(|window\./);
});

test('HTML sitemap reads the published Astro content collection on every build', () => {
  const page = read('src/pages/sitemap/index.astro');
  for (const snippet of [
    'await getArticles()', 'valuesWithCounts(', 'articleUrl(article)',
    'categoryUrl(item.name)', 'tagUrl(item.name)', 'seriesUrl(item.name)',
    'lastModified.toISOString()', 'Math.ceil(articles.length / 8)',
    "withBase('/tools/korea-cv/')",
  ]) assert.ok(page.includes(snippet), 'missing automatic route source: '+snippet);
});

test('Footer links the text sitemap and XML sitemap advertises the public route', () => {
  const footer = read('src/components/SiteFooter.astro');
  const xml = read('src/pages/sitemap.xml.ts');
  assert.match(footer, /href=\{withBase\('\/sitemap\/'\)\}>Sitemap<\/a>/);
  assert.ok(xml.includes("'/sitemap/'"));
  assert.ok(xml.includes("'/tools/korea-cv/'"));
  assert.match(read('src/pages/robots.txt.ts'), /Sitemap:/);
});
