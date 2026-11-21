import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pages=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const worker=readFileSync(new URL('../workers/korea-cv/src/index.mjs',import.meta.url),'utf8');
const workerConfig=readFileSync(new URL('../workers/korea-cv/wrangler.toml',import.meta.url),'utf8');

const extract=(yaml,name)=> {
  const match=yaml.match(new RegExp('^\\s*'+name+':\\s*([^\\n]+)','m'));
  assert.ok(match, 'Missing '+name);
  return match[1].trim();
};

test('Korea CV Pages retains Resume Studio OAuth client and Worker validates its configured audience',()=>{
  const pageId=extract(pages,'PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID');
  assert.match(pageId,/^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$/);
  assert.match(pageId,/^86180355982-/,'Must reuse the user-confirmed Resume Studio client');
  assert.doesNotMatch(pageId,/TBT_GOOGLE_OAUTH_CLIENT_ID/);
  // Worker receives its own runtime configuration, not from a retired deployment workflow.
  assert.match(worker,/env\\.GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(worker,/info\\.aud \\|\\| info\\.issued_to \\|\\| info\\.audience/);
  assert.match(worker,/drive\\.appdata/);
  assert.match(workerConfig,/Configure GOOGLE_OAUTH_CLIENT_ID/);
});

test('Publisher and Korea CV DEV deployment workflows stay retired without removing Pages OAuth',()=>{
  assert.equal(existsSync(new URL('../.github/workflows/deploy-publisher-dev.yml',import.meta.url)),false);
  assert.equal(existsSync(new URL('../.github/workflows/deploy-korea-cv-dev.yml',import.meta.url)),false);
  assert.doesNotMatch(pages,/PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID:\\s*\\$\\{\\{\\s*secrets\\.TBT_GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(pages,/PUBLIC_KOREA_CV_API_URL: \\$\\{\\{ vars\\.PUBLIC_KOREA_CV_API_URL \\}\\}/);
  assert.match(worker,/env\\.ALLOWED_ORIGIN/);
});
