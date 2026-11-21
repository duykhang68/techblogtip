// Korea CV Maker private Google Drive appDataFolder gateway.
// No CV data is persisted in Cloudflare KV/R2, GitHub or logs.
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const ACCESS_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const MAX_BYTES = 512 * 1024;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra}});
}
function fileName(id) { return 'korea-cv-' + id + '.json'; }
function fetchHeaders(token) { return {Authorization:'Bearer ' + token, Accept:'application/json'}; }
async function googleJson(url, init={}) {
  const res = await fetch(url, init);
  // Do not propagate raw provider errors; they can contain sensitive context.
  if (!res.ok) throw new Error('GOOGLE_' + res.status);
  return res.json();
}
function validCv(data, id) {
  if (!data || typeof data!=='object' || Array.isArray(data)) return false;
  if (data.schemaVersion!==1 || data.id!==id || typeof data.content!=='object' || !data.content || Array.isArray(data.content)) return false;
  if (!Number.isSafeInteger(data.revision) || data.revision<0) return false;
  if (typeof data.targetCompany!=='string' || data.targetCompany.length>500) return false;
  const required=['personal','essays','education','employment','certifications','languages','projects','skills','awards','training','patents','referees','research'];
  return required.every(key => key in data.content && (key==='personal'||key==='essays'
    ? typeof data.content[key]==='object' && data.content[key]!==null && !Array.isArray(data.content[key])
    : Array.isArray(data.content[key]) && data.content[key].length<=100));
}
async function identity(token, env) {
  // Access tokens are short-lived and never written to Worker storage or logs.
  // Google's tokeninfo verifies token audience and its actual consented scope.
  const info = await googleJson('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(token));
  if ((info.aud || info.issued_to || info.audience) !== env.GOOGLE_OAUTH_CLIENT_ID || !String(info.scope||'').split(' ').includes(ACCESS_SCOPE)) throw new Error('TOKEN_SCOPE');
  return info;
}
async function lookup(id, token) {
  const q = "name = '" + fileName(id) + "' and 'appDataFolder' in parents and trashed = false";
  const params = new URLSearchParams({spaces:'appDataFolder',q,fields:'files(id,name,modifiedTime),nextPageToken',pageSize:'100'});
  const payload=await googleJson(DRIVE+'?'+params, {headers:fetchHeaders(token)});
  return payload.files?.[0] || null;
}
async function list(token) {
  const params=new URLSearchParams({spaces:'appDataFolder',q:"name contains 'korea-cv-' and 'appDataFolder' in parents and trashed = false",fields:'nextPageToken,files(id,name,modifiedTime)',pageSize:'100'});
  const data=await googleJson(DRIVE+'?'+params,{headers:fetchHeaders(token)});
  return (data.files||[]).filter(f=>/^korea-cv-[0-9a-f-]{36}\.json$/i.test(f.name)).map(f=>({id:f.name.slice(9,-5),updatedAt:f.modifiedTime}));
}
async function readFile(googleId,token) { return googleJson(DRIVE+'/'+encodeURIComponent(googleId)+'?alt=media',{headers:fetchHeaders(token)}); }
async function writeFile(id, json, token, existing) {
  if (existing) {
    await googleJson(UPLOAD+'/'+encodeURIComponent(existing.id)+'?uploadType=media&fields=id,modifiedTime',{
      method:'PATCH', headers:{...fetchHeaders(token),'Content-Type':'application/json; charset=utf-8'},body:json,
    });
    return;
  }
  const boundary='kcv-'+crypto.randomUUID();
  const metadata=JSON.stringify({name:fileName(id),parents:['appDataFolder'],mimeType:'application/json'});
  const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+json+'\r\n--'+boundary+'--';
  await googleJson(UPLOAD+'?uploadType=multipart&fields=id,name',{method:'POST',headers:{...fetchHeaders(token),'Content-Type':'multipart/related; boundary='+boundary},body});
}

export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin')||'';
    const allowed=String(env.ALLOWED_ORIGIN||'https://duykhang68.github.io');
    const cors=origin===allowed ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'} : {};
    const respond=(data,status=200)=>reply(data,status,cors);
    if (request.method==='OPTIONS') return origin===allowed ? new Response(null,{status:204,headers:cors}) : respond({error:'origin_not_allowed'},403);
    if (origin && origin!==allowed) return respond({error:'origin_not_allowed'},403);
    const url=new URL(request.url);
    if (url.pathname==='/health' && request.method==='GET') return respond({status:'ok',service:'korea-cv-drive-gateway'});
    const match=url.pathname.match(/^\/api\/korea-cv(?:\/([\w-]+))?\/?$/);
    if (!match) return respond({error:'not_found'},404);
    if (!env.GOOGLE_OAUTH_CLIENT_ID) return respond({error:'not_configured'},503);
    const authorization=request.headers.get('Authorization')||'';
    if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) return respond({error:'unauthorized'},401);
    const token=authorization.slice(7);
    try { await identity(token,env); } catch { return respond({error:'invalid_google_token'},401); }
    const id=match[1];
    if (id && !ID_PATTERN.test(id)) return respond({error:'invalid_id'},400);
    try {
      if (request.method==='GET' && !id) return respond({items:await list(token)});
      if (!id) return respond({error:'method_not_allowed'},405);
      const existing=await lookup(id,token);
      if (request.method==='GET') {
        if (!existing) return respond({error:'not_found'},404);
        const data=await readFile(existing.id,token);
        if (!validCv(data,id)) return respond({error:'invalid_saved_data'},422);
        return respond({cv:data});
      }
      if (request.method==='PUT') {
        const size=Number(request.headers.get('Content-Length')||0);
        if (size>MAX_BYTES) return respond({error:'too_large'},413);
        const raw=await request.text();
        if (new TextEncoder().encode(raw).length>MAX_BYTES) return respond({error:'too_large'},413);
        let cv;try{cv=JSON.parse(raw);}catch{return respond({error:'invalid_json'},400);}
        if (!validCv(cv,id)) return respond({error:'invalid_cv'},422);
        if (existing) {
          const previous=await readFile(existing.id,token);
          if (cv.revision!==previous.revision+1) return respond({error:'revision_conflict',serverRevision:previous.revision},409);
        } else if (cv.revision!==0) return respond({error:'revision_conflict',serverRevision:null},409);
        await writeFile(id,JSON.stringify(cv),token,existing);
        return respond({saved:true,id,revision:cv.revision});
      }
      if (request.method==='DELETE') {
        if (!existing) return respond({error:'not_found'},404);
        const deleted=await fetch(DRIVE+'/'+encodeURIComponent(existing.id),{method:'DELETE',headers:fetchHeaders(token)}); if(!deleted.ok)throw new Error('GOOGLE_'+deleted.status);
        return respond({deleted:true});
      }
      return respond({error:'method_not_allowed'},405);
    } catch { return respond({error:'drive_unavailable'},502); }
  },
};
