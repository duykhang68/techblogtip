import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pages=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const worker=readFileSync(new URL('../workers/korea-cv/src/index.mjs',import.meta.url),'utf8');
const workerConfig=readFileSync(new URL('../workers/korea-cv/wrangler.toml',import.meta.url),'utf8');

const extract=(yaml,name)=> {
  const line=yaml.split('\n').find(line=>line.trimStart().startsWith(name+':'));
  assert.ok(line,'Missing '+name);
  return line.slice(line.indexOf(':')+1).trim();
};

test('Korea CV Pages retains Resume Studio OAuth client and Worker validates its configured audience',()=>{
  const pageId=extract(pages,'PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID');
  assert.match(pageId,/^[0-9]+-[a-z0-9]+[.]apps[.]googleusercontent[.]com$/);
  assert.ok(pageId.startsWith('86180355982-'),'Must reuse the user-confirmed Resume Studio client');
  assert.ok(!pageId.includes('TBT_GOOGLE_OAUTH_CLIENT_ID'));
  // Worker receives its own runtime configuration, not from a retired deployment workflow.
  assert.ok(worker.includes('env.GOOGLE_OAUTH_CLIENT_ID'));
  assert.ok(worker.includes('info.aud || info.issued_to || info.audience'));
  assert.ok(worker.includes('drive.appdata'));
  assert.ok(workerConfig.includes('Configure GOOGLE_OAUTH_CLIENT_ID'));
});

test('Publisher and Korea CV DEV deployment workflows stay retired without removing Pages OAuth',()=>{
  assert.equal(existsSync(new URL('../.github/workflows/deploy-publisher-dev.yml',import.meta.url)),false);
  assert.equal(existsSync(new URL('../.github/workflows/deploy-korea-cv-dev.yml',import.meta.url)),false);
  assert.ok(!pages.includes('secrets.TBT_GOOGLE_OAUTH_CLIENT_ID'));
  assert.ok(pages.includes('vars.PUBLIC_KOREA_CV_API_URL'));
  assert.ok(worker.includes('env.ALLOWED_ORIGIN'));
});
