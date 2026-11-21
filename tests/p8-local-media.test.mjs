import test from 'node:test';
import assert from 'node:assert/strict';
import {importLocalFiles} from '../workers/publisher/src/media-library.mjs';
import {EDITOR_HTML,EDITOR_JS} from '../workers/publisher/src/editor-ui.mjs';

const scope={sourceId:'TBT-test-local-upload-1234',tag:'a'.repeat(16),branch:'media/tbt-'+'a'.repeat(16)};

test('P8 editor exposes real local image chooser and Drive picker',()=>{
 assert.match(EDITOR_HTML,/id="local-image-files"[^>]*type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*multiple/);
 assert.match(EDITOR_HTML,/id="import-drive"/);
 assert.match(EDITOR_HTML,/Media Library · WebP tự động · Chống trùng/);
 assert.match(EDITOR_JS,/\/api\/media\/upload/);
 assert.match(EDITOR_JS,/\/api\/drive\/files/);
});

test('P8 local upload rejects empty and excessive selections',async()=>{
 await assert.rejects(importLocalFiles({},scope,[]),e=>e.code==='local_media_selection');
 await assert.rejects(importLocalFiles({},scope,new Array(5).fill({})),e=>e.code==='local_media_selection');
});

test('P8 validates local image MIME, real signature and size',async()=>{
 const invalid=(type,data)=>importLocalFiles({},scope,[{name:'image.png',type,data}]);
 await assert.rejects(invalid('image/svg+xml','AAAA'),e=>e.code==='local_media_type');
 await assert.rejects(invalid('image/png','AAAA'),e=>e.code==='local_media_signature');
 await assert.rejects(invalid('image/png','?'),e=>e.code==='local_media_base64');
});

test('P8 local PNG converts to WebP, stages on media branch and deduplicates re-import',async()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const webp=Uint8Array.from([82,73,70,70,12,0,0,0,87,69,66,80,1,2,3,4]);
 const paths=new Set();let branchExists=false,putCount=0;
 const fetcher=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET',path=u.pathname;
  let status=200,result={};
  if(method==='GET'&&path.endsWith('/git/ref/heads/'+scope.branch)){
   if(!branchExists)status=404;else result={object:{sha:'a'.repeat(40)}};
  }else if(method==='GET'&&path.endsWith('/git/ref/heads/main'))result={object:{sha:'a'.repeat(40)}};
  else if(method==='POST'&&path.endsWith('/git/refs')){branchExists=true;result={ref:'refs/heads/'+scope.branch};}
  else if(method==='GET'&&path.includes('/contents/public/media/')){
   if(!paths.has(path))status=404;else result={sha:'b'.repeat(40)};
  }else if(method==='PUT'&&path.includes('/contents/public/media/')){
   paths.add(path);putCount++;result={content:{sha:'b'.repeat(40)}};
  }else throw Error('Unexpected GitHub route '+method+' '+url);
  return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});
 };
 const images={input:()=>({transform:()=>({output:()=>({response:async()=>new Response(webp)})})})};
 const env={GITHUB_PUBLISHER_TOKEN:'fixture',IMAGES:images};
 const files=[{name:'photo.png',type:'image/png',data:Buffer.from(png).toString('base64')}];
 const first=await importLocalFiles(env,scope,files,fetcher);
 assert.equal(first.items.length,1);assert.equal(first.items[0].created,true);
 assert.match(first.items[0].path,/^\/techblogtip\/media\/tbt-[a-f0-9]{16}\/[a-f0-9]{32}\.webp$/);
 const second=await importLocalFiles(env,scope,files,fetcher);
 assert.equal(second.items[0].created,false);
 assert.equal(putCount,1);
});


test('P8 locked editor disables file selection instead of silently clearing a chosen file',()=>{
 assert.match(EDITOR_JS,/imageInput\.disabled=locked\|\|complex/);
 assert.match(EDITOR_JS,/Đã chọn '\+files\.length\+' ảnh:/);
 assert.doesNotMatch(EDITOR_JS,/status\.textContent='Bài READY hoặc chỉ đọc: hãy mở một bản DRAFT để tải ảnh\.';input\.value=''/);
 assert.match(EDITOR_JS,/finally\{input\.disabled=false;\}/);
});
