import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/pages/tools/korea-cv/index.astro',import.meta.url),'utf8');
const sync=readFileSync(new URL('../src/scripts/korea-cv-sync.ts',import.meta.url),'utf8');

test('Korea CV action controls live in Astro markup and have consistent pastel UI',()=>{
 for (const id of ['kcv-connect','kcv-new','kcv-save','kcv-signout','kcv-refresh','kcv-select','kcv-open','kcv-copy','kcv-remove']) {
   assert.match(page,new RegExp('id="'+id+'"'));
   assert.doesNotMatch(sync,new RegExp('<button[^>]*id="'+id+'"'));
 }
 assert.match(page,/kcv-toolbar-actions/);
 assert.match(page,/kcv-btn-primary/);
 assert.match(page,/@media\(max-width:600px\)/);
 assert.match(page,/aria-live="polite"/);
});
test('Disconnected is a normal, recoverable state, not an OAuth deployment error',()=>{
 assert.match(page,/Chưa kết nối/);
 assert.doesNotMatch(page,/class="kcv-note"/);
 assert.match(sync,/!configured\(clientId,api\)/);
 assert.match(sync,/thiếu Google OAuth Client ID/);
 assert.match(sync,/thiếu địa chỉ API Korea CV HTTPS/);
 assert.match(sync,/await connectGoogle\(clientId\)/);
 assert.match(sync,/await refresh\(\)/);
 assert.match(sync,/buttons\(true\)/);
});
test('saved CV controls remain separate and actions are gated on real Google auth',()=>{
 assert.match(sync,/for\(const id of \['kcv-open','kcv-copy','kcv-remove'\]\)/);
 assert.match(sync,/buttons\(false\)/);
 assert.match(sync,/CV đang nhập chưa được lưu/);
 assert.match(sync,/driveRequest\(api,'\/'\+cv\.id,'PUT',cv\)/);
});
