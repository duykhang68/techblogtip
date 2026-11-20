// Write CF secrets only in ephemeral CI workspace; do not print or expose values.
import { mkdtempSync,writeFileSync,appendFileSync,chmodSync } from 'node:fs';
import { join } from 'node:path';
const names={
  TBT_GOOGLE_OAUTH_CLIENT_ID:'GOOGLE_OAUTH_CLIENT_ID',
  TBT_ALLOWED_EDITORS:'ALLOWED_EDITORS',
  TBT_SHEETS_SPREADSHEET_ID:'SHEETS_SPREADSHEET_ID',
  TBT_SHEETS_GID:'SHEETS_GID',
  TBT_GOOGLE_SERVICE_ACCOUNT_JSON:'GOOGLE_SERVICE_ACCOUNT_JSON',
  TBT_GITHUB_PUBLISHER_TOKEN:'GITHUB_PUBLISHER_TOKEN',
};
const payload={};
for (const [key, binding] of Object.entries(names)) {
  const value=process.env[key];
  if(!value||!value.trim())throw new Error('Required secret is missing: '+key);
  payload[binding]=value.trim();
}
if(!/^[0-9]+$/.test(payload.SHEETS_GID))throw new Error('TBT_SHEETS_GID must be numeric');
if(!/^[a-zA-Z0-9_-]{15,150}$/.test(payload.SHEETS_SPREADSHEET_ID))
  throw new Error('TBT_SHEETS_SPREADSHEET_ID format is invalid');
if(!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(payload.GOOGLE_OAUTH_CLIENT_ID))
  throw new Error('TBT_GOOGLE_OAUTH_CLIENT_ID must be a Google Web OAuth client ID');
const emails=payload.ALLOWED_EDITORS.split(',').map(x=>x.trim());
if(!emails.length||emails.some(x=>!/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(x)))
  throw new Error('TBT_ALLOWED_EDITORS must be explicit comma-separated emails');
try{
  const account=JSON.parse(payload.GOOGLE_SERVICE_ACCOUNT_JSON);
  if(account.type!=='service_account'||!account.client_email?.endsWith('.gserviceaccount.com')||!account.private_key?.includes('PRIVATE KEY'))
    throw new Error('Invalid service account');
}catch {throw new Error('TBT_GOOGLE_SERVICE_ACCOUNT_JSON must be a complete Google service account JSON');}
const sha=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Cannot determine exact deployment SHA');
payload.DEPLOY_SHA=sha;
if(!process.env.RUNNER_TEMP||!process.env.GITHUB_OUTPUT)throw new Error('Not running on GitHub Actions');
const dir=mkdtempSync(join(process.env.RUNNER_TEMP,'tbt-publisher-'));
const path=join(dir,'bindings.json');
writeFileSync(path,JSON.stringify(payload),{mode:0o600,flag:'wx'});
chmodSync(path,0o600);
appendFileSync(process.env.GITHUB_OUTPUT,'file='+path+'\n');
console.log('Validated publisher configuration and prepared encrypted Worker secret bindings');
