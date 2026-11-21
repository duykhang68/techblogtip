import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectGoogle,connected,disconnectGoogle,CV_DRIVE_SCOPE,configured} from '../src/lib/korea-cv-client.mjs';

test('Google access token is rejected unless drive.appdata is actually granted', async()=>{
  const original=globalThis.google;
  try {
    globalThis.google={accounts:{oauth2:{
      initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'fake-test-access-token',expires_in:3600,scope:'openid email profile'})}),
      revoke:(_token,cb)=>cb(),
    }}};
    await assert.rejects(connectGoogle('synthetic-test-client'),/Drive appData permission not granted/);
    assert.equal(connected(),false);
    globalThis.google.accounts.oauth2.initTokenClient=opts=>({requestAccessToken:()=>opts.callback({access_token:'fake-test-access-token',expires_in:3600,scope:'openid '+CV_DRIVE_SCOPE})});
    await connectGoogle('synthetic-test-client');
    assert.equal(connected(),true);
    disconnectGoogle();
    assert.equal(connected(),false);
  }finally{globalThis.google=original;}
});
test('Production integration remains fail-closed without HTTPS Worker and OAuth ID',()=>{
 assert.equal(configured('','https://example.invalid'),false);
 assert.equal(configured('test','http://example.invalid'),false);
 assert.equal(configured('test','https://example.invalid'),true);
});
test('Korea CV saved tab does not promise unpublished fake API',()=>{
 const source=readFileSync(new URL('../src/pages/tools/korea-cv/index.astro',import.meta.url),'utf8');
 assert.doesNotMatch(source,/API riêng tư chưa được triển khai|PR tích hợp riêng/);
 assert.match(source,/Google Drive/);
 assert.match(source,/kcv-export-actions/);
});
