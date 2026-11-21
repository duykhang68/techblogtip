import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const script='scripts/publisher/create-deploy-secrets.mjs';
function verify(optionalNotion){
 const dir=mkdtempSync(join(tmpdir(),'tbt-p6-config-test-'));
 try{
  const env={
   ...process.env,
   RUNNER_TEMP:dir,
   GITHUB_OUTPUT:join(dir,'github-output'),
   GITHUB_SHA:'a'.repeat(40),
   TBT_GOOGLE_OAUTH_CLIENT_ID:'123456789-test.apps.googleusercontent.com',
   TBT_ALLOWED_EDITORS:'editor@example.com',
   TBT_SHEETS_SPREADSHEET_ID:'123456789abcdefABCDEF',
   TBT_SHEETS_GID:'123',
   TBT_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'editor@project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY----- TEST'}),
   TBT_GITHUB_PUBLISHER_TOKEN:'synthetic-token-do-not-use',
   TBT_PRODUCTION_SYNC_TOKEN:'',
   TBT_NOTION_INTEGRATION_TOKEN:optionalNotion?'secret_not-a-real-notion-token_1234567890':''
  };
  const r=spawnSync(process.execPath,[script],{cwd:process.cwd(),env,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const output=readFileSync(env.GITHUB_OUTPUT,'utf8').trim();
  assert.match(output,/^file=/);
  const payload=JSON.parse(readFileSync(output.slice(5),'utf8'));
  assert.equal(payload.DEPLOY_SHA,env.GITHUB_SHA);
  assert.equal(payload.NOTION_INTEGRATION_TOKEN,optionalNotion?env.TBT_NOTION_INTEGRATION_TOKEN:undefined);
  assert.ok(!r.stdout.includes('secret_not-a-real'));
  assert.ok(!r.stderr.includes('secret_not-a-real'));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('Publisher remains deployable without optional Notion integration',()=>verify(false));
test('Optional Notion token is only added to encrypted Worker binding payload',()=>verify(true));
