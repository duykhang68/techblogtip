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
