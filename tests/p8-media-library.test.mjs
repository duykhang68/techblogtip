import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaPath,stageArticleMedia } from '../workers/publisher/src/media-library.mjs';
const hex='a'.repeat(32);
test('P8 Media Library only allows content-addressed WebP paths',()=>{
 assert.equal(mediaPath('0123456789abcdef',hex+'.webp'),'public/media/tbt-0123456789abcdef/'+hex+'.webp');
 assert.throws(()=>mediaPath('0123456789abcdef','../../secret.jpg'));
 assert.throws(()=>mediaPath('../',hex+'.webp'));
});
test('P8 media source ownership rejects media from another article',async()=>{
 const sourceId='TBT-test-source-123456';
 const prepared={sourceId,markdown:'!['+'test'+'](/media/tbt-0000000000000000/'+hex+'.webp)'};
 await assert.rejects(stageArticleMedia({},prepared,'sheets/tbt-mock',async()=>{throw Error('must not fetch');}),/Media belongs to another article/);
});
test('P8 no-image article does not call GitHub media APIs',async()=>{
 const amount=await stageArticleMedia({}, {sourceId:'TBT-test-source-123456',markdown:'Plain article text'},'sheets/tbt-mock',async()=>{throw Error('unexpected request');});
 assert.equal(amount,0);
});
