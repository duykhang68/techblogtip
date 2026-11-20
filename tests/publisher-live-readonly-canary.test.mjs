import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheetRow } from '../scripts/publisher/sheets.mjs';
import { branchFor } from '../workers/publisher/src/github-api.mjs';
import { auditPublisherSubmission } from '../scripts/publisher/live-readonly-canary.mjs';

const context={spreadsheetId:'A'.repeat(26),sheetGid:'142694714',publishedDate:'2000-01-01'};
const runtime={SHEETS_SPREADSHEET_ID:context.spreadsheetId,SHEETS_GID:context.sheetGid};

async function fixture(){
  const cells=[
    'TBT-12345678-1234-1234-1234-123456789012',
    'Bản kiểm tra E2E an toàn',
    '## Mục tiêu\nNội dung đủ dài để kiểm tra tạo pull request từ Google Sheets và xác minh đối chiếu nguồn. '.repeat(2),
    'TechBlogTip',
    'Kiểm thử hệ thống',
    'Publisher, E2E',
    'Mô tả đầy đủ cách kiểm chứng dữ liệu và trạng thái bản thảo tại GitHub.',
    '',
    'READY',
    'kiem-tra-e2e',
    '',
    'https://github.com/duykhang68/techblogtip/pull/35',
    '','','',
  ];
  const prepared=normalizeSheetRow(cells,context);
  cells[10]=prepared.fingerprint;
  const branch=await branchFor({source:{spreadsheetId:context.spreadsheetId,sheetGid:context.sheetGid},sourceId:cells[0]});
  const pr={number:35,html_url:cells[11],head:{ref:branch,sha:'b'.repeat(40)},
    base:{ref:'main'},draft:true,merged_at:null,state:'closed',
    body:'Imported test\nsource-id: '+cells[0]+'\nsource-revision: '+prepared.fingerprint};
  const file={filename:prepared.path,status:'added'};
  const seen=[];
  const githubRead=async path=>{
    seen.push(path);
    if(path==='/pulls/35')return pr;
    if(path.startsWith('/pulls?state=all&head='))return [pr];
    if(path==='/pulls/35/files?per_page=100')return [file];
    throw Error('Unexpected GitHub path: '+path);
  };
  return {cells,prepared,pr,file,seen,githubRead,records:[{cells,rowNumber:3}]};
}
test('read-only E2E audit validates closed-unmerged Draft PR and K:L without M:O',async()=>{
  const f=await fixture();
  const result=await auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead);
  assert.equal(result.ok,true);
  assert.equal(result.prState,'closed');
  assert.equal(result.draft,true);
  assert.equal(result.releaseWriteback,false);
  assert.equal(result.sourceRevision,f.cells[10]);
  assert.equal(f.seen.length,3);
});
test('read-only E2E audit rejects missing source, DRAFT, stale fingerprint and release writes',async()=>{
  const f=await fixture();
  await assert.rejects(auditPublisherSubmission(f.records,runtime,'TBT-other-id',f.githubRead),/source_missing/);
  await assert.rejects(auditPublisherSubmission(f.records,runtime,'invalid',f.githubRead),/source_id_invalid/);
  f.cells[8]='DRAFT';
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead),/not_ready/);
  f.cells[8]='READY';f.cells[2]+=' modified';
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead),/revision_mismatch/);
  f.cells[2]=f.cells[2].slice(0,-9);f.cells[12]='https://example.com/test';
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead),/release_fields/);
});
test('read-only E2E audit rejects wrong PR metadata, duplicate branch PRs and wrong article',async()=>{
  const f=await fixture();
  f.pr.draft=false;
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead),/pr_metadata_mismatch/);
  f.pr.draft=true;
  const repeated=async path=>path.startsWith('/pulls?state=all')?[f.pr,f.pr]:f.githubRead(path);
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],repeated),/duplicate_or_missing_pr/);
  f.file.filename='src/content/articles/not-the-source.md';
  await assert.rejects(auditPublisherSubmission(f.records,runtime,f.cells[0],f.githubRead),/article_file_mismatch/);
});
