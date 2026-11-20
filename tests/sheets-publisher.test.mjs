import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHEETS_SOURCE_COLUMNS, vietnameseSlug, parseTags,
  normalizeSheetRow, prepareSheetArticle, sheetValuesToObject,
} from '../scripts/publisher/sheets.mjs';

const base = {
  sourceId: 'TBT-test-source-0001',
  title: 'Hướng dẫn sử dụng Google Sheets cơ bản',
  body: '## Tổng quan\nGoogle Sheets giúp bạn tổ chức dữ liệu, lập báo cáo và tính toán trong trình duyệt.\n\n## Thực hành\nHãy tạo một bảng dữ liệu có tiêu đề và cột nhận diện.',
  author: 'TechBlogTip',
  category: 'Tin học văn phòng',
  tags: 'Google Sheets, Spreadsheet, google sheets',
  summary: 'Hướng dẫn tổ chức bảng dữ liệu và làm quen với những tính năng cơ bản của Google Sheets.',
  series: 'Google Sheets căn bản',
  status: 'READY',
  slug: '',
  sourceHash: 'system-cell-from-old-release',
  draftPr: 'https://example.invalid/pr/1',
  publishedUrl: '',
  releaseSha: '',
  publishedAt: '',
};
const context = { spreadsheetId: 'sheet-new-project-id', sheetGid: '0', publishedDate: '2026-11-20' };

test('Vietnamese slugs and tags normalize deterministically', () => {
  assert.equal(vietnameseSlug('Định dạng bảng tính – dễ hiểu!'), 'dinh-dang-bang-tinh-de-hieu');
  assert.deepEqual(parseTags('Git, github; git,  Astro  '), ['git', 'github', 'Astro']);
});
test('column mapping is a distinct TechBlogTip contract', () => {
  assert.equal(SHEETS_SOURCE_COLUMNS.sourceId, 'A');
  assert.equal(SHEETS_SOURCE_COLUMNS.releaseSha, 'N');
  assert.equal(sheetValuesToObject(Object.values(base)).title, base.title);
});
test('READY row generates stable safe Markdown + source identity', () => {
  const prepared = prepareSheetArticle(base, context);
  assert.match(prepared.path, /^src\/content\/articles\/[a-z0-9-]+\.md$/);
  assert.match(prepared.markdown, /^---\n/);
  assert.match(prepared.markdown, /sourceType: "google-sheets"/);
  assert.match(prepared.markdown, /sourceRevision: "[a-f0-9]{64}"/);
  assert.ok(prepared.markdown.includes('## Tổng quan'));
  assert.equal(prepared.sourceRevision.length, 64);
});
test('source revision ignores row sorting and system-owned writeback fields', () => {
  const one = normalizeSheetRow(base, context);
  const two = normalizeSheetRow({...base, releaseSha:'abc', publishedUrl:'https://somewhere.invalid', sourceHash:'different', draftPr:'new'}, context);
  assert.equal(one.fingerprint, two.fingerprint);
  assert.notEqual(one.fingerprint, normalizeSheetRow({...base, body:base.body+' changed'}, context).fingerprint);
});
test('reject invalid state, identity, media and malicious content', () => {
  for (const invalid of [
    {...base, status:'DRAFT'}, {...base, sourceId:''}, {...base, body:'hi'},
    {...base, body:base.body+'\n![sample](test.png)'},
    {...base, body:base.body+'\n![image](https://drive.google.com/file/d/123)'},
    {...base, body:base.body+'\n<script>alert(1)</script>'},
  ]) assert.throws(() => prepareSheetArticle(invalid, context));
  assert.throws(() => prepareSheetArticle(base, {...context, sheetGid:''}));
  assert.throws(() => prepareSheetArticle(base, {...context, publishedDate:''}));
});
test('quoted frontmatter values cannot inject yaml', () => {
  const row = {...base, title:'Hướng dẫn "bảo mật" Google Sheets\n---\ndraft: true'};
  const prepared = prepareSheetArticle(row, context);
  const firstDoc = prepared.markdown.split('\n---\n').slice(0,2).join('\n---\n');
  assert.equal(firstDoc.split('\n').filter(x=>x.startsWith('draft:')).length, 1);
});
