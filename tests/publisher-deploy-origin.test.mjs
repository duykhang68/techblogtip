import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Publisher DEV deploy explicitly resolves Script API origin conflicts only in protected main-only workflow',()=>{
  const yml=readFileSync('.github/workflows/deploy-publisher-dev.yml','utf8');
  assert.match(yml,/workflow_dispatch:/);
  assert.match(yml,/github\.ref == 'refs\/heads\/main'/);
  assert.match(yml,/inputs\.confirm == 'deploy-dev-only'/);
  assert.match(yml,/environment: techblogtip-publisher-dev/);
  assert.match(yml,/persist-credentials: false/);
  assert.match(yml,/test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/);
  assert.match(yml,/node scripts\/publisher\/create-deploy-secrets\.mjs/);
  assert.match(yml,/npx cf build/);
  assert.match(yml,/npx cf deploy --force --no-provision --secrets-file "\$BINDINGS_FILE"/);
  assert.match(yml,/node scripts\/publisher\/verify-deploy\.mjs/);
  assert.match(yml,/Remove ephemeral secret file/);
  assert.doesNotMatch(yml,/techblogtip-production|workers\/production|--mode techblogtip-production/);
  const config=readFileSync('workers/publisher/cloudflare.config.ts','utf8');
  assert.match(config,/name: 'techblogtip-publisher-dev'/);
  assert.match(config,/SOURCE_LOCKS:/);
});
