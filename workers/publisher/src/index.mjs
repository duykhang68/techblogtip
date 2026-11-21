import { PublisherError,fail,requireSameOrigin,verifyGoogleIdToken } from './auth.mjs';
import { issueSessionCookie,verifySession,expiredSessionCookie,SESSION_TTL_SECONDS } from './session.mjs';
import { readSheet,putSystemCells,rowById,sheetConfig } from './google-api.mjs';
import { deletionPreview,deleteQueuedArticle } from './article-delete.mjs';
import { createDraftPR,inspectSubmittedSourcePR,githubRequest } from './github-api.mjs';
import { inspectPublisherPR } from './pr-status.mjs';
import { finalizeVerifiedArticle,requireProductionSync,reconcileProductionBatch } from './release-writeback.mjs';
import { readProductionStatus } from './production-status.mjs';
import { readEditorialOperations } from './editorial-operations.mjs';
import { loadEditableDraft,saveEditableDraft,forkEditableRevision } from './editorial.mjs';
import { parsePublisherPreview } from './markdown-preview.mjs';
import { notionPagePreview } from './notion-import.mjs';
import { obsidianPreview } from './obsidian-import.mjs';
import { driveImageMetadata } from './drive-import.mjs';
import { mediaScope,listDriveFiles,driveThumbnail,libraryItems,importDriveFiles,importLocalFiles,serveDraftMedia } from './media-library.mjs';
import { getSheetsToken } from './google-api.mjs';
import { withSourceWriteLock,withRowWriteLock } from './source-lock.mjs';
import { EDITOR_HTML,EDITOR_JS,EDITOR_CSS,EDITOR_IMPORT_CSS,EDITOR_WORKSPACE_CSS } from './editor-ui.mjs';
import { prepareSheetArticle } from '../../../scripts/publisher/sheets.mjs';
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from './ui.mjs';
import { PRODUCTION_HTML, PRODUCTION_JS, PRODUCTION_CSS } from './production-ui.mjs';

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
  if(match)return verifyGoogleIdToken(match[1],env.GOOGLE_OAUTH_CLIENT_ID,env.ALLOWED_EDITORS,fetcher);
  return verifySession(request,env);
}
async function jsonRequest(request,maxLength=4096){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
    fail(415,'unsupported_media','Expected application/json');
  if(Number(request.headers.get('Content-Length')||0)>maxLength)
    fail(413,'too_large','Request body too large');
  const text=await request.text();
  if(text.length>maxLength)fail(413,'too_large','Request body too large');
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
      return respond({app:'techblogtip-publisher',status:'online',releaseSha:typeof env.DEPLOY_SHA==='string'?env.DEPLOY_SHA:'local',sourceWriteLocks:!!env.SOURCE_LOCKS});
    if(request.method==='GET'&&path==='/')
      return Response.redirect(new URL('/admin',request.url),302);
    if(request.method==='GET'&&path==='/admin'){
      const clientId=String(env.GOOGLE_OAUTH_CLIENT_ID||'');
      const escaped=clientId.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return staticResponse(ADMIN_HTML.replace('__GOOGLE_CLIENT_ID__',escaped)
        .replace('</main>',PRODUCTION_HTML+'</main>')
        .replace('</body>','<script src="/production-status.js" defer></script></body>'),
        'text/html; charset=utf-8',{
        'Content-Security-Policy':"default-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https://*.googleusercontent.com https://duykhang68.github.io; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
    }
    if(request.method==='GET'&&path==='/editor'){
      // A dedicated editorial workspace under the same origin and cookie session.
      // Loading the shell is safe; protected article data is fetched with /api/draft.
      const shell='<!doctype html><html lang="vi"><head><meta charset="utf-8">'+
        '<meta name="viewport" content="width=device-width,initial-scale=1">'+
        '<meta name="robots" content="noindex,nofollow">'+
        '<title>Editor · TechBlogTip</title><link rel="stylesheet" href="/admin.css"></head>'+
        '<body class="editor-workspace"><header class="editor-workspace-header">'+
        '<a href="/admin" class="editor-workspace-back">← Hàng đợi bài viết</a>'+
        '<span class="editor-workspace-brand">TECHBLOGTIP <strong>Visual Editor</strong></span>'+
        '<span class="editor-workspace-label">Không gian biên tập</span></header>'+
        '<main class="editor-workspace-main">'+EDITOR_HTML+
        '</main><script src="/editor.js" defer></script></body></html>';
      return staticResponse(shell,'text/html; charset=utf-8',{
        'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://duykhang68.github.io; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
    }
    if(request.method==='GET'&&path==='/admin.js')
      return staticResponse(ADMIN_JS,'application/javascript; charset=utf-8');
    if(request.method==='GET'&&path==='/admin.css')
      return staticResponse(ADMIN_CSS+EDITOR_CSS+EDITOR_IMPORT_CSS+EDITOR_WORKSPACE_CSS+PRODUCTION_CSS,'text/css; charset=utf-8');
    if(request.method==='GET'&&path==='/editor.js')
      return staticResponse(EDITOR_JS,'application/javascript; charset=utf-8');
    if(request.method==='GET'&&path==='/production-status.js')
      return staticResponse(PRODUCTION_JS,'application/javascript; charset=utf-8');
    if(path.startsWith('/api/')){
      // Trusted GitHub Actions production-deploy callback. Separate strong
      // service credential, exact main workflow run, and no browser cookie.
      if(path==='/api/reconcile-production'&&request.method==='POST'){
        const payload=await jsonRequest(request,2048);
        const trusted=await requireProductionSync(request,env,payload,fetcher);
        return respond(await reconcileProductionBatch(env,trusted,fetcher));
      }
      requireSameOrigin(request);
      if(path==='/api/session'){
        if(request.method==='GET'){
          const editor=await verifySession(request,env);
          return respond({authenticated:true,editor:editor.email,expiresAt:editor.expiresAt});
        }
        if(request.method==='POST'){
          const data=await jsonRequest(request,16000);
          const editor=await verifyGoogleIdToken(data.credential,env.GOOGLE_OAUTH_CLIENT_ID,env.ALLOWED_EDITORS,fetcher);
          const sessionCookie=await issueSessionCookie(env,editor);
          const response=respond({authenticated:true,editor:editor.email,expiresIn:SESSION_TTL_SECONDS});
          response.headers.set('Set-Cookie',sessionCookie);
          return response;
        }
        if(request.method==='DELETE'){
          const response=respond({authenticated:false});
          response.headers.set('Set-Cookie',expiredSessionCookie());
          return response;
        }
        fail(405,'method_not_allowed','Unsupported session method');
      }
      const editor=await requireEditor(request,env,fetcher);
      if(request.method==='GET'&&path==='/api/preflight'){
        // Authorized, strictly read-only connection verification. Never create
        // branches, PRs or edit Sheet cells during this endpoint.
        const [sheetCheck,repoCheck]=await Promise.allSettled([
          readSheet(env,fetcher),
          githubRequest(env,'/git/ref/heads/main',{fetcher}),
        ]);
        const sheetOk=sheetCheck.status==='fulfilled';
        const repoOk=repoCheck.status==='fulfilled'&&
          /^[a-f0-9]{40}$/.test(repoCheck.value?.object?.sha||'');
        return respond({
          sheet:{ok:sheetOk,...(sheetOk?{rows:sheetCheck.value.records.length}:{
            code:sheetCheck.reason instanceof PublisherError?sheetCheck.reason.code:'connection_failed'
          })},
          github:{ok:repoOk,...(repoOk?{mainSha:repoCheck.value.object.sha}:{
            code:repoCheck.status==='rejected'&&repoCheck.reason instanceof PublisherError?
              repoCheck.reason.code:'connection_failed'
          })},
          draftPrWritePermission:'not_tested',
        });
      }
      if(request.method==='GET'&&path==='/api/editorial-operations'){
        return respond(await readEditorialOperations(env,fetcher));
      }
      if(request.method==='GET'&&path==='/api/production-status'){
        // Manual editor-triggered snapshot; read-only, never CI/production verification by inference.
        return respond(await readProductionStatus(env,fetcher));
      }
      if(request.method==='GET'&&path==='/api/rows'){
        const sheet=await readSheet(env,fetcher);
        return respond({editor:editor.email,rows:sheet.records.map(rowPreview)});
      }
      if(request.method==='GET'&&path==='/api/delete-check'){
        const query=new URL(request.url).searchParams;
        return respond(await deletionPreview(env,{
          sourceId:query.get('sourceId')||'',
          ...(query.has('rowNumber')?{rowNumber:Number(query.get('rowNumber'))}:{})
        },fetcher));
      }
      if(request.method==='POST'&&path==='/api/delete-article'){
        const payload=await jsonRequest(request,512);
        const task=()=>deleteQueuedArticle(env,payload,fetcher);
        return respond(await (payload.sourceId?
          withSourceWriteLock(env,payload.sourceId,task):
          withRowWriteLock(env,payload.rowNumber,task)));
      }
      if(path==='/api/preview'&&request.method==='POST'){
        // Authenticated and same-origin; parse locally in the Worker. Never
        // write Sheets, call GitHub, or return untrusted HTML to the browser.
        const payload=await jsonRequest(request,110000);
        return respond(parsePublisherPreview(payload.body));
      }
      if(request.method==='POST'&&path==='/api/import/notion'){
        const payload=await jsonRequest(request,2048);
        return respond(await notionPagePreview({id:payload.id,token:env.NOTION_INTEGRATION_TOKEN,fetcher}));
      }
      if(request.method==='POST'&&path==='/api/import/obsidian'){
        const payload=await jsonRequest(request,180000);
        return respond(obsidianPreview(payload));
      }
      if(request.method==='GET'&&path==='/api/drive/thumb')
        return driveThumbnail(env,new URL(request.url).searchParams.get('id'),fetcher);
      if(request.method==='GET'&&path==='/api/drive/files')
        return respond(await listDriveFiles(env,fetcher));
      if(request.method==='GET'&&path==='/api/media-library'){
        const id=new URL(request.url).searchParams.get('sourceId');
        const scope=await mediaScope(env,id,fetcher);
        return respond({sourceId:id,items:await libraryItems(env,scope,fetcher)});
      }
      if(request.method==='POST'&&path==='/api/media/import'){
        const data=await jsonRequest(request,4096);
        return respond(await withSourceWriteLock(env,data.sourceId,async()=>{
          const scope=await mediaScope(env,data.sourceId,fetcher,{editable:true});
          return importDriveFiles(env,scope,data.fileIds,fetcher);
        }));
      }
      if(request.method==='POST'&&path==='/api/media/upload'){
        const data=await jsonRequest(request,17500000);
        return respond(await withSourceWriteLock(env,data.sourceId,async()=>{
          const scope=await mediaScope(env,data.sourceId,fetcher,{editable:true});
          return importLocalFiles(env,scope,data.files,fetcher);
        }));
      }
      if(request.method==='GET'&&path.startsWith('/api/media/')){
        const match=/^\/api\/media\/(TBT-[A-Za-z0-9-]{8,80})\/([a-f0-9]{32}\.webp)$/.exec(path);
        if(!match)fail(400,'media_path_invalid','Invalid media path');
        const scope=await mediaScope(env,match[1],fetcher);
        return serveDraftMedia(env,scope,match[2],fetcher);
      }
      if(request.method==='POST'&&path==='/api/import/drive/inspect'){
        const payload=await jsonRequest(request,2048);
        const token=await getSheetsToken(env,fetcher,'https://www.googleapis.com/auth/drive.readonly');
        return respond(await driveImageMetadata({id:payload.id,token,fetcher}));
      }
      if(request.method==='POST'&&path==='/api/draft/fork'){
        const data=await jsonRequest(request,512);
        // Lock one free row; re-read the sheet under that lock before writing.
        const sheet=await readSheet(env,fetcher);
        const occupied=new Set(sheet.records.map(row=>row.rowNumber));
        const free=Array.from({length:199},(_,i)=>i+2).find(number=>!occupied.has(number));
        if(!free)fail(409,'sheet_full','No free editorial row within A1:O200');
        return respond(await withRowWriteLock(env,free,()=>
          forkEditableRevision(env,data.sourceId,data.expectedSnapshot,free,fetcher)),201);
      }
      if(path==='/api/draft'){
        if(request.method==='GET'){
          const sourceId=new URL(request.url).searchParams.get('sourceId');
          return respond(await loadEditableDraft(env,sourceId,fetcher));
        }
        if(request.method==='PUT'){
          const input=await jsonRequest(request,150000);
          return respond(await withSourceWriteLock(env,input.sourceId,()=>saveEditableDraft(env,input,fetcher)));
        }
        fail(405,'method_not_allowed','Unsupported draft method');
      }
      if(request.method==='POST'&&path==='/api/verify-release'){
        const payload=await jsonRequest(request,512);
        const sourceId=payload.sourceId;
        if(typeof sourceId!=='string'||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        return respond(await withSourceWriteLock(env,sourceId,()=>
          finalizeVerifiedArticle(env,sourceId,fetcher)));
      }
      if(request.method==='GET'&&path==='/api/pr-status'){
        const sourceId=new URL(request.url).searchParams.get('sourceId');
        if(!sourceId||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        const sheet=await readSheet(env,fetcher);
        const row=rowById(sheet.records,sourceId);
        return respond(await inspectPublisherPR(env,row,sourceId,fetcher));
      }
      if(request.method==='GET'&&path==='/api/validate'){
        const sourceId=new URL(request.url).searchParams.get('sourceId');
        if(!sourceId||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        const sheet=await readSheet(env,fetcher);
        const row=rowById(sheet.records,sourceId);
        const status=String(row.cells[8]||'DRAFT').trim().toUpperCase();
        const source=sheetConfig(env);
        const proposed=[...row.cells];
        // Validate publication requirements without changing the actual
        // user-controlled status cell in Google Sheets.
        proposed[8]='READY';
        const context={spreadsheetId:source.spreadsheetId,sheetGid:source.gid,
          publishedDate:new Date().toISOString().slice(0,10)};
        const systemOccupied=row.cells.slice(10,15).some(x=>String(x||'').trim());
        try{
          const article=prepareSheetArticle(proposed,context);
          return respond({sourceId,status,contentValid:true,
            canSubmit:status==='READY'&&!systemOccupied,
            submittedOrPublished:systemOccupied,
            sourceRevision:article.sourceRevision,issues:[],
            approvalRequired:status!=='READY'});
        }catch(error){
          return respond({sourceId,status,contentValid:false,
            canSubmit:false,submittedOrPublished:systemOccupied,
            sourceRevision:null,
            issues:[{code:'content_invalid',message:String(error.message||'Invalid article').slice(0,240)}],
            approvalRequired:true});
        }
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
        return await withRowWriteLock(env,rowNumber,async()=>{
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
        });
      }
      if(request.method==='POST'&&path==='/api/submit'){
        const payload=await jsonRequest(request);
        const sourceId=payload.sourceId;
        if(typeof sourceId!=='string'||!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId))
          fail(400,'source_invalid','System-issued source ID required');
        if(typeof payload.sourceRevision!=='string'||!/^[0-9a-f]{64}$/.test(payload.sourceRevision))
          fail(400,'revision_invalid','Refresh preview to get current revision');
        return await withSourceWriteLock(env,sourceId,async()=>{
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
        // A second click after review/merge must not try to recreate an
        // orphaned branch. Revalidate the actual source-bound PR, then read
        // back the same Sheet revision before returning an idempotent result.
        if(row.cells[11]){
          if(row.cells[10]!==prepared.sourceRevision)
            fail(409,'source_hash_conflict','Submitted source hash is incomplete or stale');
          const previous=await inspectSubmittedSourcePR(env,prepared,row.cells[11],fetcher);
          const reread=await readSheet(env,fetcher);
          const existing=rowById(reread.records,sourceId);
          sameRevision(row,existing,context);
          if(existing.cells[10]!==prepared.sourceRevision||existing.cells[11]!==previous.url)
            fail(409,'writeback_conflict','Registered PR changed during replay');
          return respond({sourceId,sourceRevision:prepared.sourceRevision,
            prUrl:previous.url,created:false,review:previous.stage,published:false},200);
        }
        const pr=await createDraftPR(env,prepared,fetcher);
        const reread=await readSheet(env,fetcher);
        const fresh=rowById(reread.records,sourceId);
        sameRevision(row,fresh,context);
        if((fresh.cells[10]&&fresh.cells[10]!==prepared.sourceRevision)||
           (fresh.cells[11]&&fresh.cells[11]!==pr.url))
          fail(409,'writeback_conflict','System-owned fields changed during request');
        if(fresh.cells[10]!==prepared.sourceRevision||fresh.cells[11]!==pr.url)
          await putSystemCells(env,reread.token,fresh.rowNumber,'K:L',[prepared.sourceRevision,pr.url],fetcher);
        // A successful Google API response is not proof that K:L persisted.
        // Fail closed on a stale/reordered row or a no-op write acknowledgment.
        const afterWrite=await readSheet(env,fetcher);
        const committed=rowById(afterWrite.records,sourceId);
        sameRevision(row,committed,context);
        if(committed.cells[10]!==prepared.sourceRevision||committed.cells[11]!==pr.url)
          fail(409,'writeback_unverified','Draft PR exists, but Sheet K:L did not persist; retry safely');
        return respond({sourceId,sourceRevision:prepared.sourceRevision,
          prUrl:pr.url,created:pr.created,review:'draft',published:false},pr.created?201:200);
        });
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
