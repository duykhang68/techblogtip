import {normalizePage, validatePage, safeFilename, BLOCK_TYPES} from './model.mjs';
import html from './ui.mjs';

const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const now = () => new Date().toISOString();
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), {status,headers:{...HEADERS,...extra}});
const fail = (code, status=400) => json({error:code},status);
const chunks = (s) => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const emailList = (s) => String(s||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
const idOk = (s) => /^[a-f0-9-]{36}$/i.test(s||'');
const jwksCache = new Map();

async function verifyAccess(req, env) {
  const domain=String(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,'');
  const aud=String(env.ACCESS_AUD||'');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !aud) throw new Error('access_not_configured');
  const token=req.headers.get('cf-access-jwt-assertion')||'';
  const parts=token.split('.');
  if (parts.length!==3) throw new Error('login_required');
  let header,payload;
  try { header=JSON.parse(new TextDecoder().decode(chunks(parts[0]))); payload=JSON.parse(new TextDecoder().decode(chunks(parts[1]))); }
  catch { throw new Error('invalid_identity'); }
  if (header.alg!=='RS256' || !header.kid) throw new Error('invalid_identity');
  const t=Math.floor(Date.now()/1000);
  if (payload.iss!==domain || !(Array.isArray(payload.aud)?payload.aud:[payload.aud]).includes(aud) ||
      typeof payload.exp!=='number' || payload.exp<=t ||
      (payload.nbf && payload.nbf>t+30)) throw new Error('invalid_identity');
  let certs=jwksCache.get(domain);
  if (!certs || certs.expire<Date.now()) {
    const res=await fetch(domain+'/cdn-cgi/access/certs');
    if (!res.ok) throw new Error('access_keys_unavailable');
    const data=await res.json();
    certs={keys:data.keys||[],expire:Date.now()+5*60*1000};
    jwksCache.set(domain,certs);
  }
  const jwk=certs.keys.find(k=>k.kid===header.kid && k.kty==='RSA');
  if (!jwk) throw new Error('invalid_identity');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,chunks(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if (!ok) throw new Error('invalid_identity');
  const email=String(payload.email||'').toLowerCase().trim();
  const admins=emailList(env.CMS_ADMINS), editors=emailList(env.CMS_EDITORS), reviewers=emailList(env.CMS_REVIEWERS);
  const role=admins.includes(email)?'admin':editors.includes(email)?'editor':reviewers.includes(email)?'reviewer':null;
  if (!email || !role) throw new Error('not_allowed');
  return {email,role};
}
function canWrite(user) {return user.role==='admin'||user.role==='editor';}
function sameOrigin(req,url) {
  return req.headers.get('origin')===url.origin && (req.headers.get('sec-fetch-site')||'same-origin')!=='cross-site';
}
async function bodyJson(req) {
  const len=Number(req.headers.get('content-length')||0);
  if (len>256*1024) throw new Error('payload_too_large');
  const body=await req.text();
  if (body.length>256*1024) throw new Error('payload_too_large');
  try {return JSON.parse(body);} catch {throw new Error('invalid_json');}
}
async function getPage(db,id) {return db.prepare('SELECT * FROM cms_pages WHERE id=?').bind(id).first();}
function publicPage(row) {
  return {id:row.id,slug:row.slug,locale:row.locale,title:row.title,description:row.description,status:row.status,revision:row.revision,updatedAt:row.updated_at,publishedAt:row.published_at,blocks:JSON.parse(row.draft_json)};
}
async function record(db,row,actor) {
  await db.prepare('INSERT INTO cms_revisions (page_id,revision,document_json,actor,created_at) VALUES (?,?,?,?,?)')
    .bind(row.id,row.revision,JSON.stringify({slug:row.slug,title:row.title,description:row.description,locale:row.locale,blocks:JSON.parse(row.draft_json)}),actor,now()).run();
}
async function api(req,url,env,user) {
  const db=env.CMS_DB;
  if (!db) return fail('database_not_bound',503);
  const parts=url.pathname.split('/').filter(Boolean),method=req.method;
  if (method==='GET' && url.pathname==='/api/me') return json(user);
  if (method==='GET' && url.pathname==='/api/schema') return json({blocks:BLOCK_TYPES});
  if (parts[1]==='pages' && parts.length===2) {
    if (method==='GET') {
      const result=await db.prepare('SELECT id,slug,locale,title,status,revision,updated_at,published_at FROM cms_pages ORDER BY updated_at DESC LIMIT 100').all();
      return json({items:result.results||[]});
    }
    if (method==='POST') {
      if(!canWrite(user))return fail('forbidden',403);
      const input=normalizePage(await bodyJson(req)), errors=validatePage(input);
      if(errors.length)return json({error:'validation_failed',details:errors},422);
      const id=crypto.randomUUID(),stamp=now();
      try {
        await db.prepare('INSERT INTO cms_pages (id,slug,locale,title,description,draft_json,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
          .bind(id,input.slug,input.locale,input.title,input.description,JSON.stringify(input.blocks),'draft',stamp,stamp).run();
      } catch {return fail('slug_already_exists',409);}
      const row=await getPage(db,id); await record(db,row,user.email);
      return json({page:publicPage(row)},201);
    }
  }
  if (parts[1]==='pages' && idOk(parts[2])) {
    const id=parts[2],row=await getPage(db,id);
    if (!row) return fail('not_found',404);
    if (parts.length===3 && method==='GET') return json({page:publicPage(row)});
    if (parts.length===3 && method==='PUT') {
      if(!canWrite(user))return fail('forbidden',403);
      const body=await bodyJson(req),doc=normalizePage(body);
      if(!Number.isInteger(body.revision)||body.revision!==row.revision)return json({error:'revision_conflict',currentRevision:row.revision},409);
      const errors=validatePage(doc);if(errors.length)return json({error:'validation_failed',details:errors},422);
      const changed=await db.prepare('UPDATE cms_pages SET slug=?,locale=?,title=?,description=?,draft_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
        .bind(doc.slug,doc.locale,doc.title,doc.description,JSON.stringify(doc.blocks),now(),id,row.revision).run().catch(()=>null);
      if (!changed) return fail('slug_already_exists',409);
      if (!changed.meta?.changes) return fail('revision_conflict',409);
      const fresh=await getPage(db,id);await record(db,fresh,user.email);
      return json({page:publicPage(fresh)});
    }
    if (parts.length===3 && method==='DELETE') {
      if(user.role!=='admin')return fail('forbidden',403);
      await db.prepare('DELETE FROM cms_pages WHERE id=?').bind(id).run();
      return json({ok:true});
    }
    if (parts[3]==='publish' && parts.length===4 && method==='POST') {
      if(user.role!=='admin')return fail('forbidden',403);
      const publishedDoc={slug:row.slug,locale:row.locale,title:row.title,description:row.description,blocks:JSON.parse(row.draft_json)};
      const stamp=now();
      const changed=await db.prepare("UPDATE cms_pages SET published_json=?,published_slug=?,published_locale=?,published_at=?,status='published',updated_at=? WHERE id=?")
        .bind(JSON.stringify(publishedDoc),row.slug,row.locale,stamp,stamp,id).run().catch(()=>null);
      if(!changed)return fail('published_slug_conflict',409);
      return json({ok:!!changed.meta?.changes});
    }
    if (parts[3]==='unpublish' && parts.length===4 && method==='POST') {
      if(user.role!=='admin')return fail('forbidden',403);
      await db.prepare("UPDATE cms_pages SET published_json=NULL,published_slug=NULL,published_locale=NULL,published_at=NULL,status='draft',updated_at=? WHERE id=?").bind(now(),id).run();
      return json({ok:true});
    }
    if (parts[3]==='revisions' && parts.length===4 && method==='GET') {
      const result=await db.prepare('SELECT revision,actor,created_at,document_json FROM cms_revisions WHERE page_id=? ORDER BY revision DESC LIMIT 30').bind(id).all();
      return json({items:result.results||[]});
    }
    if (parts[3]==='restore' && parts.length===4 && method==='POST') {
      if(!canWrite(user))return fail('forbidden',403);
      const body=await bodyJson(req),version=Number(body.revision);
      const saved=await db.prepare('SELECT document_json FROM cms_revisions WHERE page_id=? AND revision=?').bind(id,version).first();
      if(!saved)return fail('revision_not_found',404);
      const doc=normalizePage(JSON.parse(saved.document_json));const errors=validatePage(doc);
      if(errors.length)return fail('revision_invalid',422);
      const change=await db.prepare('UPDATE cms_pages SET slug=?,locale=?,title=?,description=?,draft_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
        .bind(doc.slug,doc.locale,doc.title,doc.description,JSON.stringify(doc.blocks),now(),id,row.revision).run().catch(()=>null);
      if(!change?.meta?.changes)return fail('restore_conflict',409);
      const fresh=await getPage(db,id);await record(db,fresh,user.email);
      return json({page:publicPage(fresh)});
    }
    if (parts[3]==='comments' && parts.length===4) {
      if(method==='GET') {
        const result=await db.prepare('SELECT id,author,body,created_at FROM cms_comments WHERE page_id=? ORDER BY created_at DESC LIMIT 80').bind(id).all();
        return json({items:result.results||[]});
      }
      if(method==='POST') {
        const data=await bodyJson(req),body=String(data.body||'').trim();
        if(!body||body.length>2000)return fail('invalid_comment',422);
        await db.prepare('INSERT INTO cms_comments (id,page_id,author,body,created_at) VALUES (?,?,?,?,?)')
          .bind(crypto.randomUUID(),id,user.email,body,now()).run();
        return json({ok:true},201);
      }
    }
  }
  if(parts[1]==='assets' && parts.length===2) {
    if(method==='GET') {
      const r=await db.prepare('SELECT id,filename,mime,size,created_at FROM cms_assets ORDER BY created_at DESC LIMIT 100').all();
      return json({items:(r.results||[]).map(x=>({...x,src:'/media/'+x.id}))});
    }
    if(method==='POST') {
      if(!canWrite(user))return fail('forbidden',403);
      if(!env.CMS_MEDIA)return fail('media_not_bound',503);
      const mime=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
      if(!['image/webp','image/png','image/jpeg','image/avif','image/gif'].includes(mime))return fail('unsupported_image_type',415);
      const advertised=Number(req.headers.get('content-length')||0);
      if(advertised>8*1024*1024)return fail('file_too_large',413);
      const data=await req.arrayBuffer();
      if(!data.byteLength||data.byteLength>8*1024*1024)return fail('file_too_large',413);
      const signature=new Uint8Array(data.slice(0,16));
      const is=(...b)=>b.every((x,i)=>signature[i]===x);
      const valid=(mime==='image/png'&&is(137,80,78,71,13,10,26,10))||
        (mime==='image/jpeg'&&is(255,216,255))||
        (mime==='image/gif'&&(new TextDecoder().decode(signature.slice(0,6))==='GIF89a'||new TextDecoder().decode(signature.slice(0,6))==='GIF87a'))||
        (mime==='image/webp'&&new TextDecoder().decode(signature.slice(0,4))==='RIFF'&&new TextDecoder().decode(signature.slice(8,12))==='WEBP')||
        (mime==='image/avif'&&new TextDecoder().decode(signature.slice(4,12)).includes('ftypavif'));
      if(!valid)return fail('invalid_image_signature',415);
      const id=crypto.randomUUID(),filename=safeFilename(req.headers.get('x-file-name')||'image');
      await env.CMS_MEDIA.put(id,data,{httpMetadata:{contentType:mime,cacheControl:'public, max-age=31536000, immutable'}});
      await db.prepare('INSERT INTO cms_assets (id,filename,mime,size,created_at) VALUES (?,?,?,?,?)')
        .bind(id,filename,mime,data.byteLength,now()).run();
      return json({item:{id,filename,mime,size:data.byteLength,src:'/media/'+id}},201);
    }
  }
  return fail('not_found',404);
}
async function published(url,env) {
  if(!env.CMS_DB)return fail('database_not_bound',503);
  const p=url.pathname.split('/').filter(Boolean),locale=p[2],slug=p[3];
  if(!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale||'')||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug||''))return fail('not_found',404);
  const row=await env.CMS_DB.prepare("SELECT published_at,published_json FROM cms_pages WHERE published_slug=? AND published_locale=? AND status='published'")
    .bind(slug,locale).first();
  if(!row?.published_json)return fail('not_found',404);
  return json({...JSON.parse(row.published_json),publishedAt:row.published_at},200,{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=60'});
}
export default {
  async fetch(req,env) {
    const url=new URL(req.url),method=req.method;
    if(url.pathname==='/health'&&method==='GET')return json({service:'free-visual-cms',status:'ok',configured:!!(env.CMS_DB&&env.ACCESS_TEAM_DOMAIN&&env.ACCESS_AUD)});
    if(url.pathname.startsWith('/api/published/')&&method==='GET')return published(url,env);
    if(url.pathname.startsWith('/media/')&&method==='GET') {
      const id=url.pathname.slice('/media/'.length);
      if(!idOk(id)||!env.CMS_MEDIA||!env.CMS_DB)return fail('not_found',404);
      const info=await env.CMS_DB.prepare('SELECT mime FROM cms_assets WHERE id=?').bind(id).first();
      if(!info)return fail('not_found',404);
      const object=await env.CMS_MEDIA.get(id);
      if(!object)return fail('not_found',404);
      return new Response(object.body,{headers:{'content-type':info.mime,'cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"}});
    }
    let user;
    try{user=await verifyAccess(req,env);}
    catch(e){return fail(e.message==='not_allowed'?'forbidden':e.message==='access_not_configured'?'access_not_configured':'unauthorized',e.message==='access_not_configured'?503:e.message==='not_allowed'?403:401);}
    if(method!=='GET'&&!sameOrigin(req,url))return fail('origin_denied',403);
    try{
      if((url.pathname==='/'||url.pathname==='/admin'||url.pathname==='/admin/')&&method==='GET')
        return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
      if(url.pathname.startsWith('/api/'))return await api(req,url,env,user);
      return fail('not_found',404);
    }catch(e){
      if(e.message==='payload_too_large')return fail('payload_too_large',413);
      if(e.message==='invalid_json')return fail('invalid_json',400);
      return fail('internal_error',500);
    }
  }
};
