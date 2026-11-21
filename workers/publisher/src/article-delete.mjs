import { fail } from './auth.mjs';
import { readSheet, rowById, clearArticleCells } from './google-api.mjs';

const ID_PATTERN=/^TBT-[A-Za-z0-9-]{8,80}$/;
const SNAPSHOT_PATTERN=/^[a-f0-9]{64}$/;
const DELETABLE_STATES=new Set(['','IDEA','DRAFT','REVIEW','READY']);

function articleRow(sheet,selection){
  if(!selection||typeof selection!=='object'||Array.isArray(selection))
    fail(400,'delete_invalid','Select a queued article before deleting it');
  const id=selection.sourceId;
  let row;
  if(typeof id==='string'&&id){
    if(!ID_PATTERN.test(id))fail(400,'source_invalid','Invalid source ID');
    row=rowById(sheet.records,id);
    if(selection.rowNumber!==undefined&&row.rowNumber!==selection.rowNumber)
      fail(409,'delete_conflict','The article changed row in Google Sheets. Reload before deleting');
  }else{
    if(id!==undefined&&id!=='')fail(400,'source_invalid','Invalid source ID');
    if(!Number.isInteger(selection.rowNumber)||selection.rowNumber<2||selection.rowNumber>200)
      fail(400,'row_invalid','Select a valid Google Sheets row');
    row=sheet.records.find(r=>r.rowNumber===selection.rowNumber);
    if(!row)fail(404,'source_missing','Article no longer exists in Google Sheets');
    if(row.cells[0].trim())fail(409,'delete_conflict','This article was assigned an ID. Reload before deleting');
  }
  return row;
}

function requireDeletable(row){
  const status=row.cells[8].trim().toUpperCase();
  if(!DELETABLE_STATES.has(status))
    fail(409,'delete_locked','Only unsubmitted IDEA, DRAFT, REVIEW or READY articles can be deleted');
  if(row.cells.slice(10,15).some(value=>value.trim()))
    fail(409,'delete_locked','This article has PR or release metadata; it cannot be deleted from the queue');
}

async function rowSnapshot(row,env){
  const payload=JSON.stringify({
    spreadsheetId:env.SHEETS_SPREADSHEET_ID,gid:String(env.SHEETS_GID),
    rowNumber:row.rowNumber,cells:row.cells,
  });
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

// Read-only server preview, used to render a deliberate confirmation dialog.
export async function deletionPreview(env,selection,fetcher=fetch){
  const sheet=await readSheet(env,fetcher);
  const row=articleRow(sheet,selection);
  requireDeletable(row);
  return {
    sourceId:row.cells[0],rowNumber:row.rowNumber,
    title:row.cells[1],status:row.cells[8]||'DRAFT',
    expectedSnapshot:await rowSnapshot(row,env),
  };
}

// Never delete the physical spreadsheet row: moving rows would invalidate
// concurrent editors' row numbers and publisher source lock coordination.
// Clearing A:O permanently erases this article while preserving row indexes.
export async function deleteQueuedArticle(env,request,fetcher=fetch){
  if(!SNAPSHOT_PATTERN.test(request?.expectedSnapshot||''))
    fail(400,'delete_invalid','Fresh delete confirmation is required');
  const sheet=await readSheet(env,fetcher);
  const row=articleRow(sheet,request);
  requireDeletable(row);
  if(await rowSnapshot(row,env)!==request.expectedSnapshot)
    fail(409,'delete_conflict','Article changed in Google Sheets. Reload and confirm again');
  await clearArticleCells(env,sheet.token,row.rowNumber,fetcher);
  const after=await readSheet(env,fetcher);
  if(after.records.some(item=>item.rowNumber===row.rowNumber))
    fail(502,'delete_not_verified','Google Sheets did not confirm the article was erased');
  return {deleted:true,sourceId:row.cells[0],rowNumber:row.rowNumber,title:row.cells[1]};
}
