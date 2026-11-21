import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../src/pages/tools/korea-cv/index.astro',import.meta.url),'utf8');
const branding=readFileSync(new URL('../docs/BRANDING.md',import.meta.url),'utf8');

test('Korea CV follows site identity rather than inventing a disconnected palette',()=>{
  for(const token of ['--ink','--muted','--line','--accent','--soft']){
    assert.ok(page.includes('var('+token+')'),'missing brand token '+token);
  }
  assert.doesNotMatch(page,/linear-gradient\(/);
  assert.doesNotMatch(page,/--cv-ink:\s*#[0-9a-f]{6}/i);
  assert.match(branding,/Form-based tool UX/);
  assert.match(page,/kcv-section-nav/);
});
test('Form preview has human labels instead of exposing raw developer JSON',()=>{
  assert.match(page,/id="temporary-preview"/);
  assert.match(page,/Xem trước hồ sơ/);
  assert.doesNotMatch(page,/id="temporary-json"/);
  assert.doesNotMatch(page,/JSON\.stringify\(data,null,2\)/);
  assert.match(page,/textContent=value\.trim\(\)/);
});
test('Critical sections link to real anchors for keyboard and mobile navigation',()=>{
  for(const section of ['cv-application','cv-section-personal','cv-section-education','cv-section-employment','cv-section-projects','cv-essays']){
    assert.ok(page.includes('href="#'+section+'"'),section+' jump link missing');
    assert.ok(page.includes(section+'\u0022')||page.includes('cv-section-\u0024{section.id}'),section+' target missing');
  }
});
