import { fail } from './auth.mjs';
import { rowById, readSheet, putEditorialCells, writeRevisionRow } from './google-api.mjs';

const fields=['title','body','author','category','tags','summary','series','slug'];
const editableStates=new Set(['IDEA','DRAFT','REVIEW']);
const idPattern=/^TBT-[A-Za-z0-9-]{8,80}$/;
const hashPattern=/^[a-f0-9]{64}$/;
const utf8=new TextEncoder();
const limits={title:140,body:100000,author:100,category:80,tags:600,summary:200,series:100,slug:100};

function editableRow(row){
  if(!row)fail(404,'source_missing','Source row not found');
  const values=row.cells,status=String(values[8]||'').trim().toUpperCase();
  if(!editableStates.has(status))
    fail(409,'draft_locked','Only IDEA, DRAFT or REVIEW rows can be edited in Publisher');
  if(values.slice(10,15).some(x=>String(x||'').trim()))
    fail(409,'draft_locked','A submitted or published article cannot be edited here');
}
function canOpenForWriting(row){
  return !!row && editableStates.has(String(row.cells[8]||'').trim().toUpperCase()) &&
    !row.cells.slice(10,15).some(value=>String(value||'').trim());
}
function draftData(row){
  return Object.fromEntries(fields.map((name,i)=>[name,row.cells[i<7?i+1:9]]));
}
export async function draftSnapshot(row,env){
  const {SHEETS_SPREADSHEET_ID,SHEETS_GID}=env;
  const stable={id:row.cells[0],spreadsheetId:SHEETS_SPREADSHEET_ID,gid:String(SHEETS_GID),cells:row.cells};
  const digest=await crypto.subtle.digest('SHA-256',utf8.encode(JSON.stringify(stable)));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function safeText(value,max,label){
  if(typeof value!=='string'||value.length>max||value.includes('\u0000'))
    fail(422,'draft_invalid',label+' must be a valid text field (maximum '+max+' characters)');
  return value.replace(/\r\n?/g,'\n').trim();
}
export function validateDraftFields(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).length!==fields.length||
    !fields.every(field=>Object.hasOwn(payload,field)))
    fail(422,'draft_invalid','Provide exactly the eight editorial fields');
  const data=Object.fromEntries(fields.map(name=>[name,safeText(payload[name],limits[name],name)]));
  if(data.slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))
    fail(422,'draft_invalid','Slug must use lowercase ASCII letters, digits and hyphens');
  if(/<\s*\/?[a-z][^>]*>/i.test(data.body)||/\]\(\s*(?:javascript|vbscript|data)\s*:/i.test(data.body)||
      /javascript\s*:/i.test(data.body))
    fail(422,'draft_invalid','Raw HTML or unsafe Markdown links are forbidden');
  if(/!\[[^\]]*\]\(https?:\/\/(?:drive|docs)\.google\.com\//i.test(data.body)||
     /!\[[^\]]*\]\([^)]*\.(?:jpe?g|png|gif)(?:[?)])/i.test(data.body))
    fail(422,'draft_invalid','Images must be imported as local WebP before publication');
  for(const match of data.body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g)){
    if(!match[1].trim()||!/\.webp(?:\?[^)]*)?$/i.test(match[2])||/^(?:https?:)?\/\//i.test(match[2]))
      fail(422,'draft_invalid','Images need alt text and local WebP assets');
  }
  const tags=data.tags.split(/[,;\n]/).map(t=>t.trim()).filter(Boolean);
  if(tags.length>12||tags.some(t=>t.length>45))
    fail(422,'draft_invalid','Maximum 12 tags of 45 characters');
  return data;
}
export async function loadEditableDraft(env,sourceId,fetcher=fetch){
  if(typeof sourceId!=='string'||!idPattern.test(sourceId))
    fail(400,'source_invalid','System-issued source ID required');
  const sheet=await readSheet(env,fetcher);
  const row=rowById(sheet.records,sourceId);
  if(!row)fail(404,'source_missing','Source row not found');
  // Opening the visual workspace is not a write permission. The PUT guard remains strict.
  return {sourceId,status:row.cells[8],editable:canOpenForWriting(row),
    fields:draftData(row),snapshot:await draftSnapshot(row,env)};
}
export async function saveEditableDraft(env,request,fetcher=fetch){
  const {sourceId,expectedSnapshot,fields:input}=request||{};
  if(typeof sourceId!=='string'||!idPattern.test(sourceId)||
    typeof expectedSnapshot!=='string'||!hashPattern.test(expectedSnapshot))
    fail(400,'draft_invalid','Source ID and fresh draft snapshot required');
  const values=validateDraftFields(input);
  const sheet=await readSheet(env,fetcher);
  const row=rowById(sheet.records,sourceId);
  editableRow(row);
  if(await draftSnapshot(row,env)!==expectedSnapshot)
    fail(409,'draft_conflict','This draft changed in Google Sheets. Reload before saving');
  const expectedStatus=row.cells[8],originalId=row.cells[0];
  const saved=fields.every((name,i)=>values[name]===row.cells[i<7?i+1:9]);
  if(saved)return {sourceId,saved:false,snapshot:expectedSnapshot,fields:values};
  await putEditorialCells(env,sheet.token,row.rowNumber,values,fetcher);
  const freshSheet=await readSheet(env,fetcher);
  const updated=rowById(freshSheet.records,sourceId);
  editableRow(updated);
  if(updated.cells[0]!==originalId||updated.cells[8]!==expectedStatus||
     fields.some((name,i)=>updated.cells[i<7?i+1:9]!==values[name]))
    fail(409,'draft_write_conflict','Draft was changed while saving; check Sheet before retry');
  return {sourceId,saved:true,snapshot:await draftSnapshot(updated,env),fields:values};
}


// Called under a destination row lock. The original row is never changed.
export async function forkEditableRevision(env,sourceId,expectedSnapshot,rowNumber,fetcher=fetch){
 if(typeof sourceId!=='string'||!idPattern.test(sourceId)||
    typeof expectedSnapshot!=='string'||!hashPattern.test(expectedSnapshot))
  fail(400,'draft_invalid','Source ID and current snapshot required');
 const sheet=await readSheet(env,fetcher),source=rowById(sheet.records,sourceId);
 if(!source)fail(404,'source_missing','Original article not found');
 if(await draftSnapshot(source,env)!==expectedSnapshot)
  fail(409,'draft_conflict','Original article changed. Reload before creating a revision');
 if(canOpenForWriting(source))
  fail(409,'revision_not_needed','Article already editable');
 if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)
  fail(400,'row_invalid','Invalid revision row');
 const occupied=sheet.records.find(row=>row.rowNumber===rowNumber);
 if(occupied)fail(409,'revision_slot_busy','Revision row was occupied. Retry');
 const newId='TBT-'+crypto.randomUUID();
 const cells=[newId,...source.cells.slice(1,8),'DRAFT',source.cells[9],'','','','',''];
 // The new row has no GitHub PR, release hash or publication metadata.
 await writeRevisionRow(env,sheet.token,rowNumber,cells,fetcher);
 const after=await readSheet(env,fetcher),created=rowById(after.records,newId);
 if(!created||created.rowNumber!==rowNumber||created.cells[8]!=='DRAFT'||
    created.cells.slice(10).some(Boolean))
  fail(409,'revision_write_conflict','Cannot verify revision row; inspect Sheets');
 return {sourceId:newId,originalSourceId:sourceId,status:'DRAFT',rowNumber,
  snapshot:await draftSnapshot(created,env)};
}
