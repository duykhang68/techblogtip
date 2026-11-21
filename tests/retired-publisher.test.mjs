import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
test('decommissioned writer modules and workflow cannot silently return',()=>{
 for(const path of [
  'workers/publisher',
  'scripts/publisher',
  'src/pages/editorial-dashboard',
  '.github/workflows/deploy-publisher-dev.yml',
  '.github/workflows/publisher-worker.yml',
  '.github/workflows/publisher-live-readonly-canary.yml',
  'docs/SHEETS-PUBLISHER.md',
  'docs/EDITOR-V2.md',
  'docs/P6-P8-IMPORTS.md',
  'docs/PHASE3-ONE-TIME-SETUP.md'
 ])assert.equal(existsSync(path),false,'Retired component accidentally restored: '+path);
});
test('public blog and separate Korea CV remain available',()=>{
 for(const path of [
  'workers/korea-cv/src/index.mjs',
  'src/pages/tools/korea-cv/index.astro',
  'src/content/articles/techblogtip-100-diem-google-pagespeed-insights.md',
  'src/pages/archieve/index.astro',
  'scripts/verify-production-deploy.mjs'
 ])assert.equal(existsSync(path),true,'Existing public content/service missing: '+path);
});
test('production and CI no longer invoke the retired writer or its credentials',()=>{
 const quality=read('.github/workflows/quality.yml');
 const deploy=read('.github/workflows/deploy-production.yml');
 const fifo=read('.github/workflows/fifo-event-driven.yml');
 assert.doesNotMatch(quality,/qa:publisher|publisher:test/i);
 assert.doesNotMatch(deploy,/TBT_PRODUCTION_SYNC_TOKEN|reconcile-from-actions|scripts\/publisher/i);
 assert.doesNotMatch(fifo,/Publisher Worker · Bundle & Auth Contract/);
 assert.doesNotMatch(read('src/pages/sitemap.xml.ts'),/editorial-dashboard/);
});
