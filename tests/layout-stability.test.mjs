import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression: offscreen layout must never be replaced with a guessed height.
// Actual square cover/image dimensions already reserve space during lazy loads.
test('variable-height sections keep real layout geometry while scrolling', () => {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /content-visibility\s*:\s*auto\s*;/i);
  assert.doesNotMatch(css, /contain-intrinsic-size\s*:/i);
  assert.match(css, /\.card-art\{[^}]*aspect-ratio\s*:\s*1\s*;/);
});

test('web font is optional to avoid late visual reflow', () => {
  const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /display=swap/);
  assert.match(layout, /display=optional/);
  assert.match(layout, /media="print" onload="this\.media='all'"/);
});

test('image deferral retains lazy scheduling with an observer', () => {
  const cards = readFileSync(new URL('../src/components/ArticleCard.astro', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/scripts/deferred-media.ts', import.meta.url), 'utf8');
  assert.match(cards, /width="640" height="640"/);
  assert.match(cards, /data-defer-src/);
  assert.match(runtime, /IntersectionObserver/);
});
