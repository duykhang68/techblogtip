import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePublisherPreview, previewInline } from '../workers/publisher/src/markdown-preview.mjs';

test('preview displays real publisher editorial sections, tables, quote, lists and code',()=>{
  const src=`# Google Sheets Publisher

> Một bài viết chỉ hoàn tất khi URL và SHA công khai khớp nhau.

## Sáu bước

- Google Sheets
- Draft PR

| Trạm | Kết quả |
| --- | --- |
| CI | PASS |
| Release | verified |

\`\`\`js
console.log("<script>alert(1)</script>")
\`\`\`

[Xem blog](https://duykhang68.github.io/techblogtip/)

![Publication flow](/assets/publisher-flow.webp)`;
  const result=parsePublisherPreview(src);
  const kinds=result.blocks.map(x=>x.type);
  for(const name of ['heading','blockquote','unordered_list','table','code_block','paragraph','image'])
    assert.ok(kinds.includes(name),'Missing '+name);
  const table=result.blocks.find(x=>x.type==='table');
  assert.equal(table.headers.length,2);
  assert.equal(table.rows.length,2);
  assert.equal(result.blocks.find(x=>x.type==='code_block').language,'js');
  assert.match(result.blocks.find(x=>x.type==='code_block').text,/<script>alert/);
  assert.equal(result.blocks.find(x=>x.type==='image').src,
    'https://duykhang68.github.io/techblogtip/assets/publisher-flow.webp');
  assert.equal(result.format,'safe-markdown-preview-v1');
});

test('preview treats malicious HTML as literal text and rejects malicious Markdown URLs',()=>{
  const tokens=previewInline('**Đậm** *nghiêng* `code` [phishing](javascript:alert) ![Sai](https://bad.example/x.webp)');
  assert.ok(tokens.some(x=>x.type==='strong'&&x.text==='Đậm'));
  assert.ok(tokens.some(x=>x.type==='em'&&x.text==='nghiêng'));
  assert.ok(tokens.some(x=>x.type==='code'&&x.text==='code'));
  assert.ok(!tokens.some(x=>x.type==='link'&&x.href.includes('javascript:')));
  assert.ok(!tokens.some(x=>x.type==='image'));
  const raw=parsePublisherPreview('<script>doBadThings()</script>');
  assert.equal(raw.blocks[0].type,'paragraph');
  assert.equal(raw.blocks[0].inlines[0].text,'<script>doBadThings()</script>');
  assert.ok(previewInline('[outside root](/admin)')[0].href.endsWith('/techblogtip/admin'));
  assert.ok(previewInline('[Mail](mailto:editor@example.com)').some(x=>x.type==='link'));
});

test('preview refuses invalid media, oversized body, unsafe protocols, and limits runaway blocks',()=>{
  assert.equal(parsePublisherPreview('![Alt](https://drive.google.com/image.webp)').blocks[0].type,'notice');
  assert.equal(parsePublisherPreview('![Alt](/images/picture.png)').blocks[0].type,'notice');
  assert.equal(parsePublisherPreview('![Alt](/images/picture.webp?token=1)').blocks[0].type,'notice');
  assert.throws(()=>parsePublisherPreview('x'.repeat(100001)),{code:'preview_invalid'});
  assert.throws(()=>parsePublisherPreview('\0'),{code:'preview_invalid'});
  assert.throws(()=>parsePublisherPreview(Array.from({length:650},(_,i)=>'## '+i).join('\n')),{code:'preview_too_large'});
  assert.ok(previewInline('[Unsafe](data:text/html)')[0].type==='text');
});

test('editor preview is on demand, read-only and uses safe DOM text APIs',()=>{
  const source=readFileSync('workers/publisher/src/editor-ui.mjs','utf8');
  const route=readFileSync('workers/publisher/src/index.mjs','utf8');
  assert.match(source,/editor-preview-toggle/);
  assert.match(source,/editor-preview-pane/);
  assert.match(source,/api\/preview/);
  assert.match(source,/document\.createElement/);
  assert.match(source,/\.textContent/);
  assert.match(source,/editor-preview-prose/);
  assert.match(source,/max-width:700px/);
  assert.doesNotMatch(source,/\.innerHTML\s*=/);
  assert.match(source,/canvas\.contentEditable=\(complex\|\|locked\)/);
  assert.match(route,/requireSameOrigin\(request\)/);
  assert.ok(route.indexOf("const editor=await requireEditor(") < route.indexOf("path==='/api/preview'"));
  assert.match(route,/parsePublisherPreview\(payload\.body\)/);
  assert.match(route,/img-src 'self' data: https:\/\/\*\.googleusercontent\.com https:\/\/duykhang68\.github\.io/);
});
