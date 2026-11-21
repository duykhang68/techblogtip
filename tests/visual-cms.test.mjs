import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePage,validatePage,safeFilename,BLOCK_TYPES} from '../apps/visual-cms/src/model.mjs';
test('CMS block types and safe filenames',()=>{
  assert.ok(BLOCK_TYPES.includes('paragraph'));
  assert.equal(safeFilename('../../unsafe.png'),'.._.._unsafe.png');
});
test('CMS validates documents, rejects XSS sources and duplicate blocks',()=>{
  const good=normalizePage({title:'Xin chào',slug:'xin-chao',locale:'vi',blocks:[{id:'a',type:'heading',props:{text:'Đọc dễ'}}]});
  assert.deepEqual(validatePage(good),[]);
  assert.ok(validatePage(normalizePage({...good,blocks:[{id:'x',type:'image',props:{src:'javascript:alert(1)'}}]})).includes('image_source'));
  assert.ok(validatePage(normalizePage({...good,blocks:[{id:'x',type:'heading',props:{}},{id:'x',type:'heading',props:{}}]})).includes('block_id'));
  assert.ok(validatePage(normalizePage({...good,blocks:[{id:'x',type:'button',props:{url:'//bad.example'}}]})).includes('button_url'));
});
test('CMS cannot accept missing title or unsafe slugs',()=>{
  assert.ok(validatePage(normalizePage({title:'',slug:'hello world'})).includes('title'));
  assert.ok(validatePage(normalizePage({title:'ok',slug:'../../x'})).includes('slug'));
});

test('CMS validates null blocks without throwing and rejects block with missing type',()=>{
  const p=normalizePage({title:'Safe',slug:'safe',blocks:[null]});
  assert.ok(validatePage(p).includes('block_type'));
});
