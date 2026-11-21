import {requireStaff} from './auth.mjs';

// G-CMS isolated API. Static GitHub Pages is the admin shell, never the data store.
// Every private endpoint requires Google ID token + explicit staff allowlist.
const stamp = () => new Date().toISOString();
const text = (value,max=2000) => String(value ?? '').trim().slice(0,max);
const safeId = value => /^[0-9a-f-]{36}$/i.test(String(value || ''));
const send = (body,status=200,headers={}) => new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}
});
const error = (message,status=400) => send({error:message},status);
const roles = {admin:3,editor:2,reviewer:1};
const allowed = (actor,level) => roles[actor.role] >= level;
async function input(request) {
  if (Number(request.headers.get('content-length') || 0)>131072) throw Error('payload_too_large');
  const value=await request.text();
  if (value.length>131072) throw Error('payload_too_large');
  try {return JSON.parse(value);} catch {throw Error('invalid_json');}
}
function normalize(doc) {
  if (!doc || typeof doc!=='object'||Array.isArray(doc)) throw Error('invalid_document');
  const title=text(doc.title,180),slug=text(doc.slug,180).toLowerCase();
  const type=text(doc.type,10),visibility=text(doc.visibility||'public',10);
  if (!['post','page'].includes(type)||!title||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!['public','members','paid'].includes(visibility)) throw Error('invalid_entry_metadata');
  if (!Array.isArray(doc.blocks)||doc.blocks.length>120) throw Error('invalid_blocks');
  const blocks=doc.blocks.map(block=>{
    if (!block || typeof block!=='object' || !['paragraph','heading','quote','code','image','divider'].includes(block.type)) throw Error('invalid_block');
    const value=text(block.text,16000);
    if (['heading','paragraph','quote','code'].includes(block.type)&&!value) throw Error('empty_block');
    if (block.type==='image' && !/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(value)) throw Error('invalid_image_url');
    return {type:block.type,text:value};
  });
  if (blocks.length===0) throw Error('empty_content');
  const tags=Array.isArray(doc.tags)?[...new Set(doc.tags.map(t=>text(t,40)).filter(Boolean))].slice(0,30):[];
  const seo={
    title:text(doc.seo?.title,180),description:text(doc.seo?.description,300),
    canonical:text(doc.seo?.canonical,400)
  };
  if (seo.canonical && !/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(seo.canonical)) throw Error('invalid_canonical_url');
  return {title,slug,type,visibility,excerpt:text(doc.excerpt,500),blocks,tags,seo};
}
const decode = row => ({
  id:row.id,type:row.type,title:row.title,slug:row.slug,excerpt:row.excerpt,
  blocks:JSON.parse(row.body_json),tags:JSON.parse(row.tags_json),seo:JSON.parse(row.seo_json),
  visibility:row.visibility,status:row.status,author:row.author,revision:row.revision,
  scheduledAt:row.scheduled_at,publishedAt:row.published_at,createdAt:row.created_at,updatedAt:row.updated_at
});
async function snapshot(db,row,actor) {
  await db.prepare('INSERT INTO gcms_versions (entry_id,revision,snapshot_json,actor,created_at) VALUES (?,?,?,?,?)')
    .bind(row.id,row.revision,JSON.stringify(decode(row)),actor,stamp()).run();
}
async function audit(db,actor,action,resource,id,details={}) {
  await db.prepare('INSERT INTO gcms_audit (id,actor,action,resource,resource_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),actor,action,resource,id,JSON.stringify(details),stamp()).run();
}
async function load(db,id) {return db.prepare('SELECT * FROM gcms_entries WHERE id=?').bind(id).first();}
const change = async (db,sql,params) => {
  const result=await db.prepare(sql).bind(...params).run();
  return Number(result.meta?.changes || 0)>0;
};
async function entryRoutes(request,url,env,actor,segments) {
  const db=env.GCMS_DB,method=request.method,id=segments[2];
  if (!id) {
    if (method==='GET') {
      const filter=url.searchParams.get('type');
      if (filter && !['post','page'].includes(filter)) return error('invalid_type',422);
      const query=filter
        ?db.prepare('SELECT * FROM gcms_entries WHERE type=? ORDER BY updated_at DESC LIMIT 150').bind(filter)
        :db.prepare('SELECT * FROM gcms_entries ORDER BY updated_at DESC LIMIT 150');
      const rows=(await query.all()).results||[];
      return send({items:rows.map(decode)});
    }
    if (method==='POST') {
      if (!allowed(actor,2)) return error('forbidden',403);
      const doc=normalize(await input(request)),id=crypto.randomUUID(),t=stamp();
      const ok=await change(db,"INSERT OR IGNORE INTO gcms_entries (id,type,title,slug,excerpt,body_json,tags_json,seo_json,visibility,status,revision,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'draft',1,?,?,?)",
        [id,doc.type,doc.title,doc.slug,doc.excerpt,JSON.stringify(doc.blocks),JSON.stringify(doc.tags),JSON.stringify(doc.seo),doc.visibility,actor.email,t,t]);
      if (!ok) return error('slug_already_exists',409);
      const row=await load(db,id);
      await snapshot(db,row,actor.email);await audit(db,actor.email,'entry.create','entry',id);
      return send({entry:decode(row)},201);
    }
    return error('method_not_allowed',405);
  }
  if (!safeId(id)) return error('not_found',404);
  const row=await load(db,id);
  if (!row) return error('not_found',404);
  const action=segments[3];
  if (!action) {
    if (method==='GET') return send({entry:decode(row)});
    if (method==='PUT') {
      if (!allowed(actor,2)) return error('forbidden',403);
      const body=await input(request),doc=normalize(body);
      if (doc.type!==row.type) return error('immutable_type',422);
      if (!Number.isInteger(body.revision)||body.revision!==row.revision) return error('revision_conflict',409);
      const ok=await change(db,'UPDATE OR IGNORE gcms_entries SET title=?,slug=?,excerpt=?,body_json=?,tags_json=?,seo_json=?,visibility=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
        [doc.title,doc.slug,doc.excerpt,JSON.stringify(doc.blocks),JSON.stringify(doc.tags),JSON.stringify(doc.seo),doc.visibility,stamp(),id,row.revision]);
      if (!ok) return error('revision_conflict_or_slug_taken',409);
      const fresh=await load(db,id);await snapshot(db,fresh,actor.email);await audit(db,actor.email,'entry.update','entry',id,{revision:fresh.revision});
      return send({entry:decode(fresh)});
    }
    if (method==='DELETE') {
      if (!allowed(actor,3)) return error('forbidden',403);
      await db.prepare('DELETE FROM gcms_entries WHERE id=?').bind(id).run();
      await audit(db,actor.email,'entry.delete','entry',id);
      return send({ok:true});
    }
  }
  if (method==='GET' && action==='versions') {
    const rows=(await db.prepare('SELECT revision,actor,created_at,snapshot_json FROM gcms_versions WHERE entry_id=? ORDER BY revision DESC LIMIT 50').bind(id).all()).results||[];
    return send({items:rows.map(v=>({revision:v.revision,actor:v.actor,createdAt:v.created_at,entry:JSON.parse(v.snapshot_json)}))});
  }
  if (method==='POST' && action==='restore') {
    if (!allowed(actor,2)) return error('forbidden',403);
    const body=await input(request),version=Number(body.revision);
    if (!Number.isInteger(version)||version<1) return error('invalid_revision',422);
    const saved=await db.prepare('SELECT snapshot_json FROM gcms_versions WHERE entry_id=? AND revision=?').bind(id,version).first();
    if (!saved) return error('version_not_found',404);
    const doc=normalize(JSON.parse(saved.snapshot_json));
    const ok=await change(db,'UPDATE OR IGNORE gcms_entries SET title=?,slug=?,excerpt=?,body_json=?,tags_json=?,seo_json=?,visibility=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
      [doc.title,doc.slug,doc.excerpt,JSON.stringify(doc.blocks),JSON.stringify(doc.tags),JSON.stringify(doc.seo),doc.visibility,stamp(),id,row.revision]);
    if (!ok) return error('revision_conflict_or_slug_taken',409);
    const fresh=await load(db,id);await snapshot(db,fresh,actor.email);await audit(db,actor.email,'entry.restore','entry',id,{version});
    return send({entry:decode(fresh)});
  }
  if (method==='POST' && ['publish','unpublish','schedule'].includes(action)) {
    if (!allowed(actor,3)) return error('forbidden',403);
    const t=stamp();
    if (action==='publish') {
      const published=JSON.stringify({...decode(row),status:'published',publishedAt:t});
      await db.prepare("UPDATE gcms_entries SET status='published',scheduled_at=NULL,published_at=?,published_json=?,updated_at=? WHERE id=?")
        .bind(t,published,t,id).run();
    } else if (action==='unpublish') {
      await db.prepare("UPDATE gcms_entries SET status='draft',scheduled_at=NULL,published_at=NULL,published_json=NULL,updated_at=? WHERE id=?").bind(t,id).run();
    } else {
      const body=await input(request),date=new Date(body.scheduledAt||'');
      if (!Number.isFinite(date.getTime())||date.getTime()<=Date.now()+60000) return error('schedule_must_be_future',422);
      await db.prepare("UPDATE gcms_entries SET status='scheduled',scheduled_at=?,updated_at=? WHERE id=?").bind(date.toISOString(),t,id).run();
    }
    await audit(db,actor.email,'entry.'+action,'entry',id);
    return send({entry:decode(await load(db,id))});
  }
  return error('not_found',404);
}
async function members(request,env,actor,segments) {
  if (!allowed(actor,3)) return error('forbidden',403);
  const db=env.GCMS_DB,id=segments[2];
  if (!id && request.method==='GET') {
    const rows=(await db.prepare('SELECT * FROM gcms_members ORDER BY created_at DESC LIMIT 200').all()).results||[];
    return send({items:rows.map(row=>({...row,labels:JSON.parse(row.labels_json),labels_json:undefined}))});
  }
  if (!id && request.method==='POST') {
    const body=await input(request),email=text(body.email,254).toLowerCase(),name=text(body.name,160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('invalid_email',422);
    const labels=Array.isArray(body.labels)?body.labels.map(x=>text(x,40)).slice(0,30):[];
    const id=crypto.randomUUID(),t=stamp();
    const ok=await change(db,"INSERT OR IGNORE INTO gcms_members (id,email,name,labels_json,status,created_at,updated_at) VALUES (?,?,?,?,'free',?,?)",[id,email,name,JSON.stringify(labels),t,t]);
    if (!ok) return error('member_exists',409);
    await audit(db,actor.email,'member.create','member',id);
    return send({item:{id,email,name,labels,status:'free'}},201);
  }
  if (safeId(id) && request.method==='DELETE') {
    await db.prepare('DELETE FROM gcms_members WHERE id=?').bind(id).run();
    await audit(db,actor.email,'member.delete','member',id);
    return send({ok:true});
  }
  return error('not_found',404);
}
async function catalog(request,env,actor,resource) {
  const definitions={
    newsletters:{table:'gcms_newsletters',fields:['title','description'],select:'id,title,description,status,created_at,updated_at'},
    tiers:{table:'gcms_tiers',fields:['name','description','monthly_cents','yearly_cents','currency'],select:'*'}
  };
  const cfg=definitions[resource],db=env.GCMS_DB;
  if (request.method==='GET') {
    const rows=(await db.prepare('SELECT '+cfg.select+' FROM '+cfg.table+' ORDER BY created_at DESC LIMIT 100').all()).results||[];
    return send({items:rows});
  }
  if (request.method==='POST') {
    if (!allowed(actor,3)) return error('forbidden',403);
    const body=await input(request),id=crypto.randomUUID(),t=stamp();
    if (resource==='newsletters') {
      const title=text(body.title,160);
      if (!title) return error('title_required',422);
      await db.prepare("INSERT INTO gcms_newsletters(id,title,description,status,created_at,updated_at) VALUES (?,?,?,'draft',?,?)")
        .bind(id,title,text(body.description,400),t,t).run();
    } else {
      const name=text(body.name,160),currency=text(body.currency||'USD',3).toUpperCase();
      const monthly=Number(body.monthly_cents),yearly=Number(body.yearly_cents);
      if (!name||!/^[A-Z]{3}$/.test(currency)||![monthly,yearly].every(n=>Number.isInteger(n)&&n>=0&&n<=1e9)) return error('invalid_tier',422);
      await db.prepare('INSERT INTO gcms_tiers(id,name,description,monthly_cents,yearly_cents,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id,name,text(body.description,400),monthly,yearly,currency,t,t).run();
    }
    await audit(db,actor.email,resource+'.create',resource,id);
    return send({ok:true,id},201);
  }
  return error('method_not_allowed',405);
}
async function upload(request,env,actor) {
  if (!allowed(actor,2)) return error('forbidden',403);
  if (!env.GCMS_MEDIA) return error('media_not_bound',503);
  const mime=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if (!['image/webp','image/png','image/jpeg'].includes(mime)) return error('unsupported_media_type',415);
  if (Number(request.headers.get('content-length')||0)>8*1024*1024) return error('media_too_large',413);
  const bytes=await request.arrayBuffer();
  if (!bytes.byteLength||bytes.byteLength>8*1024*1024) return error('media_too_large',413);
  const sig=new Uint8Array(bytes.slice(0,12)),ascii=new TextDecoder().decode(sig);
  const valid=(mime==='image/png'&&sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71)
   ||(mime==='image/jpeg'&&sig[0]===255&&sig[1]===216&&sig[2]===255)
   ||(mime==='image/webp'&&ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP');
  if (!valid) return error('invalid_media_signature',415);
  const id=crypto.randomUUID(),filename=text(request.headers.get('x-file-name')||'image',120).replace(/[^a-z0-9_.-]/gi,'_');
  await env.GCMS_MEDIA.put(id,bytes,{httpMetadata:{contentType:mime,cacheControl:'public, max-age=86400'}});
  await env.GCMS_DB.prepare('INSERT INTO gcms_media(id,filename,mime,size,created_at) VALUES(?,?,?,?,?)')
    .bind(id,filename,mime,bytes.byteLength,stamp()).run();
  await audit(env.GCMS_DB,actor.email,'media.upload','media',id);
  return send({item:{id,filename,mime,size:bytes.byteLength,path:'/media/'+id}},201);
}
async function publicContent(url,env,kind) {
  if (!env.GCMS_DB) return error('database_not_bound',503);
  if (!['posts','pages'].includes(kind)) return error('not_found',404);
  const type=kind==='posts'?'post':'page';
  const rows=(await env.GCMS_DB.prepare("SELECT published_json,published_at FROM gcms_entries WHERE status='published' AND type=? AND published_json IS NOT NULL ORDER BY published_at DESC LIMIT 50").bind(type).all()).results||[];
  const items=rows.map(row=>{
    const {author, ...entry}=JSON.parse(row.published_json); // Staff email must not leak to readers.
    if(entry.visibility!=='public')return {...entry,blocks:[],restricted:true,publishedAt:row.published_at};
    return {...entry,restricted:false,publishedAt:row.published_at};
  });
  const response=send({items},200,{'cache-control':'public, max-age=60','access-control-allow-origin':'*'});
  return response;
}
async function route(request,env) {
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if (path==='/health' && method==='GET') {
    const configured=!!(env.GCMS_DB&&env.GCMS_GOOGLE_CLIENT_ID&&env.GCMS_ADMINS);
    return send({service:'g-cms',status:configured?'ok':'setup_required',
      configured,media:!!env.GCMS_MEDIA,sourceSha:String(env.SOURCE_SHA||'unknown')});
  }
  if (path==='/api/config'&&method==='GET') return send({
    apiBase:url.origin,googleClientId:String(env.GCMS_GOOGLE_CLIENT_ID||'')});
  if (path==='/') return Response.redirect('https://duykhang68.github.io/techblogtip/gcms/',302);
  const segments=path.split('/').filter(Boolean);
  if (segments[0]==='api'&&segments[1]==='content'&&method==='GET')
    return publicContent(url,env,segments[2]);
  if (segments[0]==='media'&&safeId(segments[1])&&method==='GET') {
    if (!env.GCMS_MEDIA) return error('media_not_bound',503);
    const object=await env.GCMS_MEDIA.get(segments[1]);
    if (!object) return error('not_found',404);
    return new Response(object.body,{headers:{
      'content-type':object.httpMetadata?.contentType||'application/octet-stream',
      'cache-control':'public, max-age=86400','x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; sandbox",
      'access-control-allow-origin':'*'
    }});
  }
  if (segments[0]!=='api') return error('not_found',404);
  if (!env.GCMS_DB) return error('database_not_bound',503);
  let actor;
  try {actor=await requireStaff(request,env);}
  catch (e) {return error(e.message==='not_allowed'?'forbidden':e.message==='google_oauth_not_configured'?'oauth_not_configured':'unauthorized',e.message==='not_allowed'?403:e.message==='google_oauth_not_configured'?503:401);}
  if (path==='/api/me'&&method==='GET')return send(actor);
  if (path==='/api/stats'&&method==='GET'){
    const counts={};
    for (const [name,query] of Object.entries({
      posts:"SELECT COUNT(*) n FROM gcms_entries WHERE type='post'",
      pages:"SELECT COUNT(*) n FROM gcms_entries WHERE type='page'",
      drafts:"SELECT COUNT(*) n FROM gcms_entries WHERE status='draft'",
      scheduled:"SELECT COUNT(*) n FROM gcms_entries WHERE status='scheduled'",
      published:"SELECT COUNT(*) n FROM gcms_entries WHERE status='published'",
      members:'SELECT COUNT(*) n FROM gcms_members',
      newsletters:'SELECT COUNT(*) n FROM gcms_newsletters',
      tiers:'SELECT COUNT(*) n FROM gcms_tiers'
    }))counts[name]=(await env.GCMS_DB.prepare(query).first()).n;
    return send(counts);
  }
  if (segments[1]==='entries')return entryRoutes(request,url,env,actor,segments);
  if (segments[1]==='members')return members(request,env,actor,segments);
  if (['newsletters','tiers'].includes(segments[1])&&segments.length===2)return catalog(request,env,actor,segments[1]);
  if (segments[1]==='media'&&method==='GET'){
    const rows=(await env.GCMS_DB.prepare('SELECT * FROM gcms_media ORDER BY created_at DESC LIMIT 150').all()).results||[];
    return send({items:rows.map(row=>({...row,path:'/media/'+row.id}))});
  }
  if (segments[1]==='media'&&method==='POST')return upload(request,env,actor);
  if (segments[1]==='audit'&&method==='GET') {
    if (!allowed(actor,3))return error('forbidden',403);
    const rows=(await env.GCMS_DB.prepare('SELECT actor,action,resource,resource_id,created_at FROM gcms_audit ORDER BY created_at DESC LIMIT 100').all()).results||[];
    return send({items:rows});
  }
  return error('not_found',404);
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('origin'),trusted=origin==='https://duykhang68.github.io';
    const cors=trusted?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers':'Authorization,Content-Type,X-File-Name','vary':'Origin'}:{};
    if(request.method==='OPTIONS') return new Response(null,{status:trusted?204:403,headers:cors});
    try {
      const response=await route(request,env),headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors))headers.set(key,value);
      return new Response(response.body,{status:response.status,headers});
    } catch(e) {
      const code=['invalid_json','payload_too_large','invalid_document','invalid_entry_metadata','invalid_blocks','invalid_block','empty_block','empty_content','invalid_image_url','invalid_canonical_url'].includes(e.message)?e.message:'internal_error';
      const status=code==='payload_too_large'?413:code==='internal_error'?500:422;
      const response=error(code,status);
      for(const [key,value] of Object.entries(cors))response.headers.set(key,value);
      return response;
    }
  },
  // Requires an explicit Cloudflare Cron Trigger after backend deployment.
  async scheduled(event,env) {
    if (!env.GCMS_DB) throw Error('database_not_bound');
    const due=(await env.GCMS_DB.prepare("SELECT * FROM gcms_entries WHERE status='scheduled' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 30").bind(stamp()).all()).results||[];
    for(const row of due) {
      const t=stamp();
      const published=JSON.stringify(decode(row));
      const updated=await change(env.GCMS_DB,"UPDATE gcms_entries SET status='published',published_json=?,published_at=?,scheduled_at=NULL,updated_at=? WHERE id=? AND status='scheduled'",[published,t,t,row.id]);
      if(updated)await audit(env.GCMS_DB,'scheduler','entry.publish','entry',row.id);
    }
  }
};