import { fail } from './auth.mjs';
import { driveImageWebp } from './drive-import.mjs';
import { getSheetsToken, readSheet, rowById } from './google-api.mjs';
import { githubRequest } from './github-api.mjs';

const ROOT='https://www.googleapis.com/drive/v3/files';
const FOLDER='1fcSwrezXFPJXr69bH135xa2bilZcZ2ID';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
const SOURCE=/^TBT-[A-Za-z0-9-]{8,80}$/;
const FILE=/^[a-f0-9]{32}\.webp$/;
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),x=>x.toString(16).padStart(2,'0')).join('');
export function mediaPath(tag,filename){if(!/^[a-f0-9]{16}$/.test(tag)||!FILE.test(filename))fail(400,'media_path_invalid','Invalid media path');return 'public/media/tbt-'+tag+'/'+filename;}
export async function mediaScope(env,sourceId,fetcher=fetch,{editable=false}={}){
 if(!SOURCE.test(String(sourceId||'')))fail(400,'source_invalid','System-issued source ID required');
 const sheet=await readSheet(env,fetcher),row=rowById(sheet.records,sourceId);
 if(editable&&( !['IDEA','DRAFT','REVIEW'].includes(String(row.cells[8]||'').trim().toUpperCase()) ||
 row.cells.slice(10,15).some(x=>String(x||'').trim())))fail(409,'draft_locked','Cannot add media to submitted or locked article');
 const tag=(await sha(sourceId)).slice(0,16);
 return {tag,branch:'media/tbt-'+tag,sourceId};
}
async function getDriveToken(env,fetcher){return getSheetsToken(env,fetcher,DRIVE_SCOPE);}
async function googleGet(url,token,fetcher){
 const res=await fetcher(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!res.ok)fail(res.status===403?403:502,'drive_access_denied','Drive folder is not shared with the Publisher service account');
 return res;
}
export async function listDriveFiles(env,fetcher=fetch){
 const folder=String(env.DRIVE_MEDIA_FOLDER_ID||FOLDER);
 if(!/^[\w-]{10,150}$/.test(folder))fail(503,'drive_folder_missing','Invalid Drive media folder');
 const token=await getDriveToken(env,fetcher);
 const q=new URLSearchParams({q:"'"+folder+"' in parents and trashed = false",fields:'nextPageToken,files(id,name,mimeType,size)',page_size:'100',pageSize:'100'});
 q.delete('page_size');
 const all=[];let cursor;
 do{
  if(cursor)q.set('pageToken',cursor);else q.delete('pageToken');
  const data=await (await googleGet(ROOT+'?'+q,token,fetcher)).json();
  all.push(...(data.files||[]).filter(f=>['image/jpeg','image/png','image/webp'].includes(f.mimeType)&&Number(f.size)>0&&Number(f.size)<=10000000).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size)})));
  cursor=data.nextPageToken;
  if(all.length>300)fail(413,'drive_folder_large','Folder exceeds 300 supported media files');
 }while(cursor);
 return {files:all,folderId:folder};
}
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const bytes64=text=>Uint8Array.from(atob(String(text||'').replace(/\s/g,'')),x=>x.charCodeAt(0));
async function branchReady(env,scope,fetcher){
 const read=(p,opts)=>githubRequest(env,p,{fetcher,...opts});
 const ref=await read('/git/ref/heads/'+scope.branch,{missingOk:true});
 if(ref)return;
 const main=await read('/git/ref/heads/main');
 if(!/^[a-f0-9]{40}$/.test(main?.object?.sha||''))fail(502,'main_sha_invalid','Cannot verify main SHA');
 await read('/git/refs',{method:'POST',body:{ref:'refs/heads/'+scope.branch,sha:main.object.sha}});
}
export async function libraryItems(env,scope,fetcher=fetch){
 const data=await githubRequest(env,'/contents/public/media/tbt-'+scope.tag+'?ref='+encodeURIComponent(scope.branch),{fetcher,missingOk:true});
 if(!data)return [];
 if(!Array.isArray(data))fail(502,'media_library_invalid','Invalid GitHub Media Library');
 return data.filter(x=>x.type==='file'&&FILE.test(x.name)).map(x=>({filename:x.name,path:'/techblogtip/media/tbt-'+scope.tag+'/'+x.name,bytes:x.size,preview:'/api/media/'+encodeURIComponent(scope.sourceId)+'/'+x.name}));
}
export async function importDriveFiles(env,scope,ids,fetcher=fetch){
 if(!Array.isArray(ids)||!ids.length||ids.length>8||new Set(ids).size!==ids.length)fail(422,'media_selection_invalid','Choose 1–8 unique images');
 const list=await listDriveFiles(env,fetcher),allowed=new Set(list.files.map(x=>x.id));
 if(ids.some(id=>!allowed.has(id)))fail(403,'media_folder_denied','Selected media must belong to the configured Drive folder');
 const token=await getDriveToken(env,fetcher);
 const imported=[];
 for(const id of ids){
  const {file,webp}=await driveImageWebp({id,token,images:env.IMAGES,fetcher});
  if(webp.byteLength>950000)fail(413,'webp_too_large','Converted WebP exceeds 950 KB GitHub storage safety limit');
  const filename=(await sha(webp)).slice(0,32)+'.webp';
  const path=mediaPath(scope.tag,filename);
  const current=await githubRequest(env,'/contents/'+path+'?ref='+encodeURIComponent(scope.branch),{fetcher,missingOk:true});
  if(!current){
   await branchReady(env,scope,fetcher);
   await githubRequest(env,'/contents/'+path,{method:'PUT',fetcher,body:{message:'media: stage Drive WebP for '+scope.sourceId,branch:scope.branch,content:b64(webp)}});
  }
  imported.push({id,name:file.name,filename,path:'/techblogtip/media/tbt-'+scope.tag+'/'+filename,preview:'/api/media/'+encodeURIComponent(scope.sourceId)+'/'+filename,created:!current,bytes:webp.length});
 }
 return {items:imported};
}
export async function serveDraftMedia(env,scope,filename,fetcher=fetch){
 if(!FILE.test(filename))fail(400,'media_file_invalid','Invalid media filename');
 const record=await githubRequest(env,'/contents/'+mediaPath(scope.tag,filename)+'?ref='+encodeURIComponent(scope.branch),{fetcher,missingOk:true});
 if(!record||record.type!=='file'||record.encoding!=='base64'||!record.content)fail(404,'media_missing','Media file not found');
 const bytes=bytes64(record.content);
 if(bytes.byteLength>1000000||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')fail(502,'media_invalid','Stored media is not valid WebP');
 return new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
}
export async function stageArticleMedia(env,prepared,branch,fetcher=fetch){
 const source=prepared.sourceId,tag=(await sha(source)).slice(0,16);
 const matches=[...prepared.markdown.matchAll(/!\[[^\]]+\]\(\/techblogtip\/media\/tbt-([a-f0-9]{16})\/([a-f0-9]{32}\.webp)\)/g)];
 const names=[...new Set(matches.map(m=>{if(m[1]!==tag)fail(422,'media_source_invalid','Media belongs to another article');return m[2];}))];
 if(names.length>30)fail(413,'media_limit','Maximum 30 images per article');
 for(const name of names){
  const path=mediaPath(tag,name);
  const blob=await githubRequest(env,'/contents/'+path+'?ref='+encodeURIComponent('media/tbt-'+tag),{fetcher,missingOk:true});
  if(!blob?.content||blob.encoding!=='base64')fail(409,'media_missing','Referenced media is missing');
  await githubRequest(env,'/contents/'+path,{method:'PUT',fetcher,body:{branch,content:blob.content.replace(/\s/g,''),message:'media: attach verified WebP to article '+source}});
 }
 return names.length;
}
