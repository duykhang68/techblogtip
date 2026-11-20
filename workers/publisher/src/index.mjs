import { PublisherError,fail,requireSameOrigin,verifyGoogleIdToken } from './auth.mjs';
import { readSheet,putSystemCells,rowById,sheetConfig } from './google-api.mjs';
import { createDraftPR } from './github-api.mjs';
import { prepareSheetArticle } from '../../../scripts/publisher/sheets.mjs';
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from './ui.mjs';

function respond(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
  }});
}
function staticResponse(body,type,headers={}){
  return new Response(body,{headers:{
    'Content-Type':type,'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    ...headers,
  }});
}
async function requireEditor(request,env,fetcher){
  const match=/^Bearer ([A-Za-z0-9_\-\.]+)$/.exec(request.headers.get('Authorization')||'');
  if(!match)fail(401,'not_authenticated','Sign in using Google to continue');
  return verifyGoogleIdToken(match[1],env.GOOGLE_OAUTH_CLIENT_ID,env.ALLOWED_EDITORS,fetcher);
}
async function jsonRequest(request){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
    fail(415,'unsupported_media','Expected application/json');
  if(Number(request.headers.get('Content-Length')||0)>4096)
    fail(413,'too_large','Request body too large');
  const text=await request.text();
  if(text.length>4096)fail(413,'too_large','Request body too large');
  let data;
  try{data=JSON.parse(text);}catch{fail(400,'json_invalid','Invalid JSON payload');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'json_invalid','Object body required');
  return data;
}
function findRowByNumber(records,rowNumber){
  const row=records.find(r=>r.rowNumber===rowNumber);
  if(!row)fail(404,'row_missing','Spreadsheet row not found');
  return row;
}
function rowPreview(row){
  const c=row.cells;
  return {
    rowNumber:row.rowNumber,sourceId:c[0],title:c[1],body:c[2],
    author:c[3],category:c[4],tags:c[5],summary:c[6],
    series:c[7],status:c[8],slug:c[9],sourceHash:c[10],
    draftPr:c[11],publishedUrl:c[12],releaseSha:c[13],publishedAt:c[14],
  };
}
function safelyPrepare(cells,context){
  try{return prepareSheetArticle(cells,context);}
  catch(error){fail(422,'source_invalid',error.message||'Source article invalid');}
}
function sameRevision(before,after,context){
  const a=safelyPrepare(before.cells,context),b=safelyPrepare(after.cells,context);
  if(a.sourceRevision!==b.sourceRevision)
    fail(409,'sheet_changed','Source row changed during Draft PR creation; review the PR and retry after resolving');
}
export async function handleRequest(request,env,{fetcher=fetch}={}){
  const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
  const requestId=crypto.randomUUID();
  try{
    if(request.method==='GET'&&path==='/health')
      return respond({app:'techblogtip-publisher',status:'ready-for-configuration',deploy:'separate-admin-worker'});
    if(request.method==='GET'&&path==='/')
      return Response.redirect(new URL('/admin',request.url),302);
    if(request.method==='GET'&&path==='/admin'){
      const clientId=String(env.GOOGLE_OAUTH_CLIENT_ID||'');
      const escaped=clientId.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return staticResponse(ADMIN_HTML.replace('__GOOGLE_CLIENT_ID__',escaped),'text/html; charset=utf-8',{
        'Content-Security-Policy':"default-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
    }
    if(request.method==='GET'&&path==='/admin.js')
      return staticResponse(ADMIN_JS,'application/javascript; charset=utf-8');
    if(request.method==='GET'&&path==='/admin.css')
      return staticResponse(ADMIN_CSS,'text/css; charset=utf-8');
    if(path.startsWith('/api/')){
      requireSameOrigin(request);
      const editor=await requireEditor(request,env,fetcher);
      if(request.method==='GET'&&path==='/api/rows'){
        const sheet=await readSheet(env,fetcher);
        return respond({editor:editor.email,rows:sheet.records.map(rowPreview)});
      }
      if(request.method==='GET'&&path==='/api/revision'){
        const sourceId=new URL(request.url).searchParams.get('sourceId');
        if(!sourceId||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        const sheet=await readSheet(env,fetcher);
        const row=rowById(sheet.records,sourceId);
        const source=sheetConfig(env);
        const context={spreadsheetId:source.spreadsheetId,sheetGid:source.gid,publishedDate:new Date().toISOString().slice(0,10)};
        const prepared=safelyPrepare(row.cells,context);
        return respond({sourceId,sourceRevision:prepared.sourceRevision,status:'READY'});
      }
      if(request.method==='POST'&&path==='/api/allocate-id'){
        const {rowNumber}=await jsonRequest(request);
        if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)
          fail(400,'row_invalid','Invalid Google Sheet row number');
        const sheet=await readSheet(env,fetcher);
        const row=findRowByNumber(sheet.records,rowNumber);
        if(row.cells[0].trim())
          return respond({sourceId:row.cells[0].trim(),created:false});
        const id='TBT-'+crypto.randomUUID();
        await putSystemCells(env,sheet.token,rowNumber,'A',[id],fetcher);
        const latest=await readSheet(env,fetcher);
        const assigned=findRowByNumber(latest.records,rowNumber);
        if(assigned.cells[0].trim()!==id||assigned.cells[1]!==row.cells[1])
          fail(409,'sheet_changed','Row changed during source ID allocation');
        return respond({sourceId:id,created:true});
      }
      if(request.method==='POST'&&path==='/api/submit'){
        const payload=await jsonRequest(request);
        const sourceId=payload.sourceId;
        if(typeof sourceId!=='string'||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        if(typeof payload.sourceRevision!=='string'||!/^[0-9a-f]{64}$/.test(payload.sourceRevision))
          fail(400,'revision_invalid','Refresh preview to get current revision');
        const source=sheetConfig(env);
        const context={spreadsheetId:source.spreadsheetId,sheetGid:source.gid,publishedDate:new Date().toISOString().slice(0,10)};
        const sheet=await readSheet(env,fetcher);
        const row=rowById(sheet.records,sourceId);
        const prepared=safelyPrepare(row.cells,context);
        if(prepared.sourceRevision!==payload.sourceRevision)
          fail(409,'revision_conflict','Source changed since preview; refresh before submitting');
        if(row.cells[10]&&row.cells[10]!==prepared.sourceRevision)
          fail(409,'source_hash_conflict','System source revision is different; manual review required');
        if(row.cells[11]&&!/^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/\d+$/.test(row.cells[11]))
          fail(409,'pr_conflict','Stored PR link is not a TechBlogTip pull request');
        const pr=await createDraftPR(env,prepared,fetcher);
        if(row.cells[11]&&row.cells[11]!==pr.url)
          fail(409,'pr_conflict','Another Draft PR is already registered for this source');
        const reread=await readSheet(env,fetcher);
        const fresh=rowById(reread.records,sourceId);
        sameRevision(row,fresh,context);
        if((fresh.cells[10]&&fresh.cells[10]!==prepared.sourceRevision)||
           (fresh.cells[11]&&fresh.cells[11]!==pr.url))
          fail(409,'writeback_conflict','System-owned fields changed during request');
        if(fresh.cells[10]!==prepared.sourceRevision||fresh.cells[11]!==pr.url)
          await putSystemCells(env,reread.token,fresh.rowNumber,'K:L',[prepared.sourceRevision,pr.url],fetcher);
        return respond({sourceId,sourceRevision:prepared.sourceRevision,prUrl:pr.url,created:pr.created,review:'draft',published:false},pr.created?201:200);
      }
      fail(405,'method_not_allowed','Unsupported API method or route');
    }
    fail(404,'not_found','Unknown publisher route');
  }catch(error){
    const status=error instanceof PublisherError?error.status:500;
    const code=error instanceof PublisherError?error.code:'internal_error';
    console.error(JSON.stringify({event:'publisher_request_error',status,code,requestId,path,method:request.method}));
    return respond({error:code,message:error instanceof PublisherError?error.message:'Publisher request failed',requestId},status);
  }
}
export default {fetch(request,env){return handleRequest(request,env);}};
