import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deferArticleMedia } from '../scripts/defer-article-media.mjs';

const read = path => readFileSync(path,'utf8');
test('article image and iframe URLs are absent until observer reaches their viewport', () => {
  const input = '<article class="prose" id="article-body"><p>Text</p><img src="/hero.webp" srcset="/small.webp 1x" alt="demo" width="600" height="400"><iframe src="/embed" title="demo"></iframe></article>';
  const output = deferArticleMedia(input);
  const activeMarkup = output.replace(/<noscript>[\s\S]*?<\/noscript>/g,'');
  assert.match(activeMarkup, /data-defer-src="\/hero.webp"/);
  assert.match(activeMarkup, /data-defer-srcset="\/small.webp 1x"/);
  assert.match(activeMarkup, /data-defer-src="\/embed"/);
  assert.doesNotMatch(activeMarkup, /\ssrc="/);
  assert.match(output, /<noscript><img src="\/hero.webp"/);
  assert.match(output, /<noscript><iframe src="\/embed"/);
  assert.equal(deferArticleMedia(output), output, 're-run must be idempotent');
});
test('non-article or non-media HTML is unchanged', () => {
  const input = '<main><article class="article-card"><img src="/above.webp"></article></main>';
  assert.equal(deferArticleMedia(input), input);
});
test('search downloads its index on demand, not on page entry', () => {
  const source=read('src/pages/tim-kiem/index.astro');
  assert.match(source, /const ensureIndex/);
  assert.match(source, /await ensureIndex\(\)/);
  assert.doesNotMatch(source, /const items: SearchItem\[\] = await fetch/);
});
test('cards retain eager high-priority LCP cover and native lazy thumbnails', () => {
  const card=read('src/components/ArticleCard.astro');
  const runtime=read('src/scripts/deferred-media.ts');
  assert.match(card, /const eagerCover = position === 1/);
  assert.match(card, /src=\{coverSrc\}/);
  assert.match(card, /loading=\{eagerCover \? 'eager' : 'lazy'\}/);
  assert.match(card, /fetchpriority=\{eagerCover \? 'high' : 'low'\}/);
  assert.doesNotMatch(card, /data-defer-src=/);
  assert.match(read('src/layouts/BaseLayout.astro'), /needsDeferredMedia/);
  assert.match(runtime, /new IntersectionObserver/);
  assert.match(runtime, /rootMargin: '160px 0px'/);
});
