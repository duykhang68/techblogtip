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

test('native thumbnail loading retains article-only IntersectionObserver', () => {
  const cards = readFileSync(new URL('../src/components/ArticleCard.astro', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/scripts/deferred-media.ts', import.meta.url), 'utf8');
  assert.match(cards, /width="640" height="640"/);
  assert.match(cards, /src=\{coverSrc\}/);
  assert.match(cards, /loading=\{eagerCover \? 'eager' : 'lazy'\}/);
  assert.doesNotMatch(cards, /data-defer-src/);
  assert.match(runtime, /IntersectionObserver/);
});

test('article title and tagline use full header width with natural Vietnamese wrapping', () => {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const title = css.match(/\/\* Editorial typography:[\s\S]*?\.article-top h1\{([^}]+)\}/)?.[1];
  assert.ok(title, 'Editorial title typography rule missing');
  assert.match(title, /max-width:\s*100%/);
  assert.match(title, /width:\s*100%/);
  assert.match(title, /text-wrap:\s*wrap/);
  assert.match(title, /text-align:\s*start/);
  assert.doesNotMatch(title, /text-align:\s*justify|text-wrap:\s*balance/);
  const lead = [...css.matchAll(/\.article-lead\{([^}]+)\}/g)].map(match=>match[1]).find(rule=>/max-width:\s*none/.test(rule));
  assert.ok(lead, 'Article tagline rule missing');
  assert.match(lead, /max-width:\s*none/);
  assert.match(lead, /width:\s*100%/);
  assert.match(lead, /text-align:\s*justify/);
  assert.match(lead, /text-align-last:\s*start/);
  assert.match(lead, /word-break:\s*normal/);
  assert.match(css, /@media\(max-width:860px\)\{\s*\.article-lead\{text-align:start\}/);
});
