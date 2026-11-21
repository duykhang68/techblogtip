import {fail} from './auth.mjs';
import {readSheet,rowById,writeRevisionRow,sheetConfig} from './google-api.mjs';
import {draftSnapshot} from './editorial.mjs';
import {prepareSheetArticle} from '../../../scripts/publisher/sheets.mjs';
import {withRowWriteLock,withSourceWriteLock} from './source-lock.mjs';

// A new article is allocated only in an unoccupied VN row. No browser storage,
// public token or alternative database is introduced.
export async function createBlankArticle(env,fetcher=fetch){
  const initial=await readSheet(env,fetcher);
  const occupied=new Set(initial.records.map(row=>row.rowNumber));
  const slot=Array.from({length:199},(_,i)=>i+2).find(n=>!occupied.has(n));
  if(!slot)fail(409,'sheet_full','Google Sheets VN has no available editorial row');
  return withRowWriteLock(env,slot,async()=>{
    const sheet=await readSheet(env,fetcher);
    if(sheet.records.some(row=>row.rowNumber===slot))
      fail(409,'row_conflict','A draft was created by another editor. Retry');
    const sourceId='TBT-'+crypto.randomUUID();
    const cells=[sourceId,'','','','','','','','DRAFT','','','','','',''];
    await writeRevisionRow(env,sheet.token,slot,cells,fetcher);
    const verified=await readSheet(env,fetcher);
    const created=rowById(verified.records,sourceId);
    if(created.rowNumber!==slot||created.cells[8]!=='DRAFT'||created.cells.slice(1,8).some(Boolean)||created.cells.slice(9).some(Boolean))
      fail(409,'draft_create_unverified','Could not verify new draft in Google Sheets');
    return {sourceId,status:'DRAFT',rowNumber:slot,snapshot:await draftSnapshot(created,env)};
  });
}

// A publication approval is explicit and source-locked. This is the ONLY
// additional writer for editor-owned status I; all K:O columns stay untouched.
export async function approveArticleForReview(env,{sourceId,expectedSnapshot},fetcher=fetch){
  if(typeof sourceId!=='string'||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId)||
     typeof expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/.test(expectedSnapshot))
    fail(400,'approval_invalid','Source ID and latest snapshot are required');
  return withSourceWriteLock(env,sourceId,async()=>{
    const sheet=await readSheet(env,fetcher);
    const row=rowById(sheet.records,sourceId);
    if(await draftSnapshot(row,env)!==expectedSnapshot)
      fail(409,'draft_conflict','Draft changed. Reload before approving');
    if(!['IDEA','DRAFT','REVIEW'].includes(String(row.cells[8]||'').toUpperCase())||
       row.cells.slice(10).some(value=>String(value||'').trim()))
      fail(409,'approval_locked','Submitted or published articles cannot be approved again');
    const proposed=[...row.cells];proposed[8]='READY';
    const source=sheetConfig(env);
    let article;
    try{article=prepareSheetArticle(proposed,{spreadsheetId:source.spreadsheetId,sheetGid:source.gid,publishedDate:new Date().toISOString().slice(0,10)});}
    catch(error){fail(422,'approval_invalid_content',String(error.message||'Article is incomplete').slice(0,240));}
    await writeApprovalStatus(env,sheet.token,row.rowNumber,fetcher);
    const verified=await readSheet(env,fetcher);
    const updated=rowById(verified.records,sourceId);
    if(updated.rowNumber!==row.rowNumber||updated.cells[8]!=='READY'||
       updated.cells.some((value,index)=>index!==8&&value!==row.cells[index]))
      fail(409,'approval_conflict','Source changed during READY transition; inspect Google Sheets');
    return {sourceId,status:'READY',sourceRevision:article.sourceRevision};
  });
}
async function writeApprovalStatus(env,token,rowNumber,fetcher){
  const {spreadsheetId}=sheetConfig(env);
  const range='VN!I'+rowNumber;
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+
    '/values/'+encodeURIComponent(range)+'?valueInputOption=RAW';
  const response=await fetcher(url,{
    method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({range,majorDimension:'ROWS',values:[['READY']]}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)fail(502,'approval_write_failed','Cannot mark source READY in Google Sheets');
}
