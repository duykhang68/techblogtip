import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaPath,stageArticleMedia } from '../workers/publisher/src/media-library.mjs';
import { driveImageWebp } from '../workers/publisher/src/drive-import.mjs';
const hex='a'.repeat(32);
test('P8 Media Library only allows content-addressed WebP paths',()=>{
 assert.equal(mediaPath('0123456789abcdef',hex+'.webp'),'public/media/tbt-0123456789abcdef/'+hex+'.webp');
 assert.throws(()=>mediaPath('0123456789abcdef','../../secret.jpg'));
 assert.throws(()=>mediaPath('../',hex+'.webp'));
});
test('P8 media source ownership rejects media from another article',async()=>{
 const sourceId='TBT-test-source-123456';
 const prepared={sourceId,markdown:'!['+'test'+'](/techblogtip/media/tbt-0000000000000000/'+hex+'.webp)'};
 await assert.rejects(stageArticleMedia({},prepared,'sheets/tbt-mock',async()=>{throw Error('must not fetch');}),/Media belongs to another article/);
});
test('P8 no-image article does not call GitHub media APIs',async()=>{
 const amount=await stageArticleMedia({}, {sourceId:'TBT-test-source-123456',markdown:'Plain article text'},'sheets/tbt-mock',async()=>{throw Error('unexpected request');});
 assert.equal(amount,0);
});

test('P8 adaptive WebP retries a large PNG and returns under 950KB',async()=>{
 let attempts=0;const params=[];
 const images={input(stream){assert.ok(stream);return {transform(o){params.push(o);return {output(o){
  attempts++;assert.equal(o.format,'image/webp');
  return {async response(){
   const len=attempts===1?950001:200;
   const bytes=new Uint8Array(len);bytes.set([82,73,70,70],0);bytes.set([87,69,66,80],8);
   return new Response(bytes);
  }};}};}};}};
 const fetcher=async url=>{
  if(url.includes('alt=media'))return new Response(new Uint8Array([1,2,3,4]));
  return Response.json({id:'0123456789abcdef',name:'large.png',mimeType:'image/png',size:'4',trashed:false,parents:['folder']});
 };
 const r=await driveImageWebp({id:'0123456789abcdef',token:'mock',images,fetcher});
 assert.equal(r.file.mimeType,'image/png');
 assert.equal(r.webp.length,200);
 assert.equal(attempts,2);
 assert.equal(params[0].width,1800);
 assert.equal(params[1].width,1400);
});
