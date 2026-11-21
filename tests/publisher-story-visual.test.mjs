import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
test('real Sheets editorial case study embeds original Lucide visuals',()=>{
  const page=read('src/pages/bai-viet/[slug].astro');
  const art=read('src/components/PublisherStoryVisual.astro');
  assert.match(page,/PublisherStoryVisual/);
  assert.match(page,/post\.data\.sourceType === 'google-sheets'/);
  assert.match(page,/hanh-trinh-xay-dung-google-sheets-publisher-techblogtip/);
  assert.match(page,/variant="flow"/);
  assert.match(page,/variant="proof"/);
  assert.equal((art.match(/no:'0[1-6]'/g)||[]).length,6);
  assert.equal((art.match(/label:'ĐÚNG /g)||[]).length,3);
  assert.match(art,/Lucide/);
  assert.match(art,/prefers-reduced-motion/);
  assert.match(art,/@media\(max-width:640px\)/);
  assert.match(art,/aria-label/);
  assert.doesNotMatch(art,/api\.github\.com|<script|cdn\.jsdelivr\.net/i);
});
