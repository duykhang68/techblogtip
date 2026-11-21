import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pages=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const worker=readFileSync(new URL('../.github/workflows/deploy-korea-cv-dev.yml',import.meta.url),'utf8');

const extract=(yaml,name)=> {
  const match=yaml.match(new RegExp('^\\s*'+name+':\\s*([^\\n]+)','m'));
  assert.ok(match, 'Missing '+name);
  return match[1].trim();
};

test('Korea CV Pages and Worker use identical existing Resume Studio public OAuth client',()=>{
  const pageId=extract(pages,'PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID');
  const workerId=extract(worker,'GOOGLE_OAUTH_CLIENT_ID');
  assert.equal(pageId,workerId,'OAuth client mismatch between Pages and Worker');
  assert.match(pageId,/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  assert.match(pageId,/^86180355982-/,'Must reuse the user-confirmed Resume Studio client');
  assert.doesNotMatch(pageId,/TBT_GOOGLE_OAUTH_CLIENT_ID/);
});
test('Retired Publisher OAuth and deployment are absent; Korea CV keeps separate OAuth',()=>{
  assert.equal(existsSync(new URL('../.github/workflows/deploy-publisher-dev.yml',import.meta.url)),false);
  assert.doesNotMatch(pages,/PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID:\s*\$\{\{\s*secrets\.TBT_GOOGLE_OAUTH_CLIENT_ID/);
  assert.doesNotMatch(worker,/GOOGLE_OAUTH_CLIENT_ID:\s*\$\{\{\s*secrets\.TBT_GOOGLE_OAUTH_CLIENT_ID/);
});
