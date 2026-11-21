// TechBlogTip Visual CMS — isolated extended CMS operations.
// Workspace boundary is enforced on the server, never by hiding UI controls.
import {normalizePage,validatePage} from './model.mjs';
const stamp=()=>new Date().toISOString();
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const error=(reason,status=400)=>response({error:reason},status);
const validId=value=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value||'')&&String(value).length<=55;
const validUUID=value=>/^[a-f0-9-]{36}$/i.test(value||'');
const allowedStages=['draft','review','approved','published'];
const canWrite=user=>user.role==='admin'||user.role==='editor';
const admin=user=>user.role==='admin';
const allowedBlockTypes=['heading','paragraph','image','quote','button','feature'];
export function spaceFrom(url){const space=url.searchParams.get('space')||'default';return validId(space)?space:null;}
export async function scopeUser(db,user,space){
 if(!space)return null;
 const exists=await db.prepare('SELECT id FROM cms_spaces WHERE id=?').bind(space).first();
 if(!exists)return null;
 if(user.owner)return {...user,role:'admin',space};
 if(space==='default'&&user.baseRole)return {...user,role:user.baseRole,space};
 const member=await db.prepare('SELECT role FROM cms_space_members WHERE space_id=? AND email=?').bind(space,user.email).first();
 return member?{...user,role:member.role,space}:null;
}
export async function audit(db,space,actor,action,resource,details={}){
 await db.prepare('INSERT INTO cms_audit(id,space_id,actor,action,resource,details,created_at) VALUES(?,?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),space,actor,action,resource,JSON.stringify(details).slice(0,1200),stamp()).run();
}
async function inputJSON(req){
 const max=128*1024,n=Number(req.headers.get('content-length')||0);
 if(n>max)throw Error('payload_too_large');
 const body=await req.text();if(body.length>max)throw Error('payload_too_large');
 try{return JSON.parse(body);}catch{throw Error('invalid_json');}
}
function validBlocks(blocks){
 if(!Array.isArray(blocks)||blocks.length>30)return false;
 const doc=normalizePage({title:'Component',slug:'component',locale:'vi',blocks});
 return doc.blocks.length===blocks.length&&doc.blocks.every(x=>allowedBlockTypes.includes(x.type))&&validatePage(doc).length===0;
}
export async function expandedBlocks(db,space,blocks) {
 const result=[],references=new Map();
 for(const block of blocks){
  if(block.type!=='global'){result.push(block);continue;}
  const ref=block.props?.componentId;
  if(!validUUID(ref))continue;
  let rows=references.get(ref);
  if(!rows){
   const record=await db.prepare('SELECT blocks_json FROM cms_components WHERE id=? AND space_id=?').bind(ref,space).first();
   rows=record?JSON.parse(record.blocks_json):[];
   references.set(ref,rows);
  }
  // Referenced components have only built-in leaf blocks, eliminating cyclic expansion.
  result.push(...rows.map(item=>({...item,id:block.id+'-'+item.id})));
  if(result.length>130)throw Error('component_expansion_too_large');
 }
 return result;
}
export async function publishAllowed(db,space,pageId){
 const workflow=await db.prepare('SELECT id FROM cms_workflows WHERE space_id=? AND active=1 LIMIT 1').bind(space).first();
 if(!workflow)return {ok:true};
 const state=await db.prepare('SELECT stage FROM cms_page_stages WHERE page_id=? AND workflow_id=?').bind(pageId,workflow.id).first();
 return state?.stage==='approved'?{ok:true}:{ok:false,error:'workflow_approval_required',stage:state?.stage||'draft'};
}
export async function publishPage(db,page,space,actor){
 const allowed=await publishAllowed(db,space,page.id);
 if(!allowed.ok)return allowed;
 const content={slug:page.slug,locale:page.locale,title:page.title,description:page.description,blocks:JSON.parse(page.draft_json)};
 const date=stamp();
 const update=await db.prepare("UPDATE cms_pages SET published_json=?,published_slug=?,published_locale=?,published_at=?,status='published',updated_at=? WHERE id=? AND space_id=?")
  .bind(JSON.stringify(content),page.slug,page.locale,date,date,page.id,space).run().catch(()=>null);
 if(!update?.meta?.changes)return {ok:false,error:'published_slug_conflict'};
 await audit(db,space,actor,'publish',page.id,{revision:page.revision});
 return {ok:true};
}
export async function scheduledTick(env){
 const db=env.CMS_DB;if(!db)return {error:'database_not_bound'};
 const due=await db.prepare("SELECT * FROM cms_schedules WHERE state='queued' AND execute_at<=? ORDER BY execute_at LIMIT 20").bind(stamp()).all();
 const result={done:0,failed:0};
 for(const row of due.results||[]){
  const claimed=await db.prepare("UPDATE cms_schedules SET state='running' WHERE id=? AND state='queued'").bind(row.id).run();
  if(!claimed.meta?.changes)continue;
  try{
   const page=await db.prepare('SELECT * FROM cms_pages WHERE id=? AND space_id=?').bind(row.page_id,row.space_id).first();
   if(!page)throw Error('page_missing');
   if(page.revision!==row.expected_revision)throw Error('revision_changed_after_scheduling');
   if(row.action==='publish'){
    const success=await publishPage(db,page,row.space_id,'scheduler');
    if(!success.ok)throw Error(success.error);
   }else{
    await db.prepare("UPDATE cms_pages SET published_json=NULL,published_slug=NULL,published_locale=NULL,published_at=NULL,status='draft',updated_at=? WHERE id=? AND space_id=?")
     .bind(stamp(),page.id,row.space_id).run();
    await audit(db,row.space_id,'scheduler','unpublish',page.id,{schedule:row.id});
   }
   await db.prepare("UPDATE cms_schedules SET state='done',finished_at=? WHERE id=?").bind(stamp(),row.id).run();result.done++;
  }catch(e){
   await db.prepare("UPDATE cms_schedules SET state='failed',error=?,finished_at=? WHERE id=?")
    .bind(String(e.message||'processing_error').slice(0,180),stamp(),row.id).run();result.failed++;
  }
 }
 return result;
}
function assertRole(user,mode){return mode==='admin'?admin(user):canWrite(user);}
function normalizeStages(value){
 if(!Array.isArray(value)||value.length<2||value.length>8)return null;
 const stages=value.map(x=>String(x).toLowerCase().trim());
 if(stages[0]!=='draft'||stages[stages.length-1]!=='approved'||new Set(stages).size!==stages.length||stages.some(x=>!/^[a-z][a-z0-9_-]{1,25}$/.test(x)))return null;
 return stages;
}
export async function advancedAPI(req,url,env,user,space) {
 const db=env.CMS_DB,method=req.method,parts=url.pathname.split('/').filter(Boolean);
 const at=(...p)=>parts.length===p.length&&p.every((part,i)=>part===parts[i]);
 if(at('api','spaces')){
  if(method==='GET'){
   const rows=user.owner?await db.prepare('SELECT * FROM cms_spaces ORDER BY created_at DESC LIMIT 50').all():
    await db.prepare("SELECT s.* FROM cms_spaces s JOIN cms_space_members m ON m.space_id=s.id WHERE m.email=? UNION SELECT s.* FROM cms_spaces s WHERE s.id='default' AND ? IS NOT NULL ORDER BY created_at DESC LIMIT 50")
    .bind(user.email,user.baseRole||null).all();
   return response({items:rows.results||[]});
  }
  if(method==='POST'){
   if(!user.owner)return error('forbidden',403);
   const body=await inputJSON(req),id=String(body.id||'').trim().toLowerCase(),title=String(body.title||'').trim();
   if(id==='default'||!validId(id)||!title||title.length>120)return error('invalid_space',422);
   const created=await db.prepare('INSERT INTO cms_spaces(id,title,created_by,created_at,updated_at) VALUES(?,?,?,?,?)')
    .bind(id,title,user.email,stamp(),stamp()).run().catch(()=>null);
   if(!created)return error('space_exists',409);
   await audit(db,id,user.email,'space.create',id,{title});
   return response({space:{id,title}},201);
  }
 }
 const spaceUser=await scopeUser(db,user,space);
 if(!spaceUser)return error('space_forbidden_or_missing',403);
 if(at('api','members')){
  if(method==='GET'){
   if(!admin(spaceUser))return error('forbidden',403);
   const result=await db.prepare('SELECT email,role,created_at FROM cms_space_members WHERE space_id=? ORDER BY email LIMIT 50').bind(space).all();
   return response({items:result.results||[]});
  }
  if(method==='POST'){
   if(!admin(spaceUser))return error('forbidden',403);
   const body=await inputJSON(req),email=String(body.email||'').trim().toLowerCase(),role=String(body.role||'');
   if(!/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,}$/.test(email)||!['admin','editor','reviewer'].includes(role))return error('invalid_member',422);
   await db.prepare('INSERT INTO cms_space_members(space_id,email,role,created_at) VALUES(?,?,?,?) ON CONFLICT(space_id,email) DO UPDATE SET role=excluded.role')
    .bind(space,email,role,stamp()).run();
   await audit(db,space,user.email,'member.set',email,{role});
   return response({ok:true});
  }
  if(method==='DELETE'){
   if(!admin(spaceUser))return error('forbidden',403);
   const email=String(url.searchParams.get('email')||'').toLowerCase();
   if(!email)return error('invalid_member',422);
   await db.prepare('DELETE FROM cms_space_members WHERE space_id=? AND email=?').bind(space,email).run();
   await audit(db,space,user.email,'member.remove',email);
   return response({ok:true});
  }
 }
 if(at('api','components')){
  if(method==='GET'){
   const rows=await db.prepare('SELECT id,name,slug,blocks_json,updated_at FROM cms_components WHERE space_id=? ORDER BY name LIMIT 100').bind(space).all();
   return response({items:(rows.results||[]).map(x=>({...x,blocks:JSON.parse(x.blocks_json),blocks_json:undefined}))});
  }
  if(method==='POST'){
   if(!canWrite(spaceUser))return error('forbidden',403);
   const data=await inputJSON(req),title=String(data.name||'').trim(),slug=String(data.slug||'').trim().toLowerCase();
   if(!title||title.length>120||!validId(slug)||!validBlocks(data.blocks))return error('component_validation_failed',422);
   const id=crypto.randomUUID();
   const saved=await db.prepare('INSERT INTO cms_components(id,space_id,name,slug,blocks_json,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(id,space,title,slug,JSON.stringify(data.blocks),stamp()).run().catch(()=>null);
   if(!saved)return error('component_slug_exists',409);
   await audit(db,space,user.email,'component.create',id,{slug});
   return response({id,name:title,slug,blocks:data.blocks},201);
  }
 }
 if(parts.length===3&&parts[0]==='api'&&parts[1]==='components'&&validUUID(parts[2])){
  const id=parts[2];
  if(method==='PUT'){
   if(!canWrite(spaceUser))return error('forbidden',403);
   const data=await inputJSON(req),name=String(data.name||'').trim(),slug=String(data.slug||'').trim().toLowerCase();
   if(!name||name.length>120||!validId(slug)||!validBlocks(data.blocks))return error('component_validation_failed',422);
   const updated=await db.prepare('UPDATE cms_components SET name=?,slug=?,blocks_json=?,updated_at=? WHERE id=? AND space_id=?')
    .bind(name,slug,JSON.stringify(data.blocks),stamp(),id,space).run().catch(()=>null);
   if(!updated)return error('component_slug_exists',409);
   if(!updated.meta?.changes)return error('not_found',404);
   await audit(db,space,user.email,'component.update',id,{slug});
   return response({ok:true});
  }
  if(method==='DELETE'){
   if(!admin(spaceUser))return error('forbidden',403);
   const used=await db.prepare("SELECT id FROM cms_pages WHERE space_id=? AND (draft_json LIKE ? OR published_json LIKE ?) LIMIT 1")
    .bind(space,'%'+id+'%','%'+id+'%').first();
   if(used)return error('component_still_referenced',409);
   const removed=await db.prepare('DELETE FROM cms_components WHERE id=? AND space_id=?').bind(id,space).run();
   if(!removed.meta?.changes)return error('not_found',404);
   await audit(db,space,user.email,'component.delete',id);return response({ok:true});
  }
 }
 if(at('api','workflows')){
  if(method==='GET'){
   const rows=await db.prepare('SELECT * FROM cms_workflows WHERE space_id=? ORDER BY updated_at DESC LIMIT 30').bind(space).all();
   return response({items:(rows.results||[]).map(x=>({...x,stages:JSON.parse(x.stages_json),stages_json:undefined}))});
  }
  if(method==='POST'){
   if(!admin(spaceUser))return error('forbidden',403);
   const body=await inputJSON(req),name=String(body.name||'').trim(),stages=normalizeStages(body.stages);
   if(!name||name.length>90||!stages)return error('invalid_workflow',422);
   const id=crypto.randomUUID();
   await db.prepare('UPDATE cms_workflows SET active=0 WHERE space_id=?').bind(space).run();
   await db.prepare('INSERT INTO cms_workflows(id,space_id,name,stages_json,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)')
    .bind(id,space,name,JSON.stringify(stages),stamp(),stamp()).run();
   await audit(db,space,user.email,'workflow.create',id,{stages});
   return response({id,name,stages,active:true},201);
  }
 }
 if(parts.length===4&&parts[0]==='api'&&parts[1]==='workflows'&&parts[2]==='pages'&&validUUID(parts[3])){
  const id=parts[3];
  const page=await db.prepare('SELECT id,revision FROM cms_pages WHERE id=? AND space_id=?').bind(id,space).first();
  if(!page)return error('not_found',404);
  const flow=await db.prepare('SELECT id,stages_json FROM cms_workflows WHERE space_id=? AND active=1 LIMIT 1').bind(space).first();
  const current=await db.prepare('SELECT stage FROM cms_page_stages WHERE page_id=?').bind(id).first();
  if(method==='GET')return response({active:!!flow,stage:current?.stage||'draft',stages:flow?JSON.parse(flow.stages_json):['draft','review','approved']});
  if(method==='POST'){
   if(!canWrite(spaceUser))return error('forbidden',403);
   if(!flow)return error('workflow_not_configured',409);
   const body=await inputJSON(req),stages=JSON.parse(flow.stages_json);
   const next=String(body.stage||''),prev=current?.stage||'draft';
   if(!stages.includes(next))return error('invalid_workflow_stage',422);
   const oldIndex=stages.indexOf(prev),newIndex=stages.indexOf(next);
   if(!admin(spaceUser)&&!(newIndex===oldIndex+1&&next!=='approved'))return error('approval_requires_admin',403);
   if(next==='approved'&&!admin(spaceUser))return error('approval_requires_admin',403);
   await db.prepare('INSERT INTO cms_page_stages(page_id,workflow_id,stage,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET workflow_id=excluded.workflow_id,stage=excluded.stage,updated_by=excluded.updated_by,updated_at=excluded.updated_at')
    .bind(id,flow.id,next,user.email,stamp()).run();
   await audit(db,space,user.email,'workflow.transition',id,{from:prev,to:next});
   return response({ok:true,stage:next});
  }
 }
 if(at('api','schedules')){
  if(method==='GET'){
   const rows=await db.prepare('SELECT id,page_id,action,execute_at,expected_revision,state,error,created_at FROM cms_schedules WHERE space_id=? ORDER BY created_at DESC LIMIT 100').bind(space).all();
   return response({items:rows.results||[]});
  }
  if(method==='POST'){
   if(!admin(spaceUser))return error('forbidden',403);
   const body=await inputJSON(req),id=String(body.pageId||''),action=String(body.action||''),at=String(body.executeAt||'');
   if(!validUUID(id)||!['publish','unpublish'].includes(action)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(at)
    ||!Number.isFinite(Date.parse(at))||Date.parse(at)<=Date.now()+60000||Date.parse(at)>Date.now()+365*86400000)return error('invalid_schedule',422);
   const page=await db.prepare('SELECT revision FROM cms_pages WHERE id=? AND space_id=?').bind(id,space).first();
   if(!page)return error('not_found',404);
   const scheduleId=crypto.randomUUID();
   await db.prepare('INSERT INTO cms_schedules(id,space_id,page_id,action,execute_at,expected_revision,state,created_by,created_at) VALUES(?,?,?,?,?,?,"queued",?,?)')
    .bind(scheduleId,space,id,action,at,page.revision,user.email,stamp()).run();
   await audit(db,space,user.email,'schedule.create',scheduleId,{pageId:id,action,executeAt:at});
   return response({id:scheduleId,state:'queued',executeAt:at},201);
  }
 }
 if(parts.length===3&&parts[0]==='api'&&parts[1]==='schedules'&&method==='DELETE'){
  if(!admin(spaceUser))return error('forbidden',403);
  const result=await db.prepare("UPDATE cms_schedules SET state='canceled',finished_at=? WHERE id=? AND space_id=? AND state='queued'")
   .bind(stamp(),parts[2],space).run();
  if(!result.meta?.changes)return error('schedule_not_cancelable',409);
  await audit(db,space,user.email,'schedule.cancel',parts[2]);
  return response({ok:true});
 }
 if(at('api','activity')&&method==='GET'){
  const rows=await db.prepare('SELECT id,actor,action,resource,details,created_at FROM cms_audit WHERE space_id=? ORDER BY created_at DESC LIMIT 100').bind(space).all();
  return response({items:rows.results||[]});
 }
 if(at('api','ai','status')&&method==='GET'){
  return response({enabled:!!(env.AI&&env.CMS_AI_ENABLED==='true'),provider:'Cloudflare Workers AI',dailyLimit:Math.min(20,Number(env.CMS_AI_DAILY_LIMIT)||5),requiresExplicitConsent:true});
 }
 if(at('api','ai','analyze')&&method==='POST'){
  if(!canWrite(spaceUser))return error('forbidden',403);
  const body=await inputJSON(req),title=String(body.title||''),description=String(body.description||''),content=String(body.content||'');
  if(content.length>16000)return error('content_too_long',422);
  return response({report:[
    {check:'title',ok:title.trim().length>=30&&title.length<=65,detail:'Recommended: 30–65 characters'},
    {check:'description',ok:description.trim().length>=90&&description.length<=160,detail:'Recommended: 90–160 characters'},
    {check:'body',ok:content.trim().length>=300,detail:'Recommended: 300+ characters for substantive pages'},
    {check:'heading',ok:/\S/.test(title),detail:'Provide a descriptive primary heading'}
  ],type:'deterministic_seo_audit',aiGenerated:false});
 }
 if(at('api','ai','generate')&&method==='POST'){
  if(!admin(spaceUser))return error('forbidden',403);
  if(!env.AI||env.CMS_AI_ENABLED!=='true')return error('ai_disabled_no_billable_requests',503);
  const body=await inputJSON(req),task=String(body.task||''),content=String(body.content||'').trim(),language=String(body.language||'vi');
  if(!['seo','translate','alt','summary'].includes(task)||!content||content.length>3500||!/^[a-z]{2}$/.test(language))return error('invalid_ai_request',422);
  const day=stamp().slice(0,10),max=Math.max(1,Math.min(20,Number(env.CMS_AI_DAILY_LIMIT)||5));
  // Atomic quota reservation before inference; unsuccessful attempts count towards safety ceiling.
  await db.prepare('INSERT OR IGNORE INTO cms_ai_usage(date,email,requests) VALUES(?,?,0)').bind(day,user.email).run();
  const hit=await db.prepare('UPDATE cms_ai_usage SET requests=requests+1 WHERE date=? AND email=? AND requests<?').bind(day,user.email,max).run();
  if(!hit.meta?.changes)return error('daily_ai_quota_exceeded',429);
  const prompts={
   seo:'Provide one Vietnamese search-friendly meta description (max 155 characters). Respond with the description only.',
   translate:'Translate faithfully to '+language+'. Preserve meaning, no inventions. Output only translation.',
   alt:'Generate accessible alt text for the supplied human-written image description. Do not invent invisible details.',
   summary:'Summarize the provided content concisely and factually in '+language+'.'
  };
  try{
   const out=await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:prompts[task]},{role:'user',content}]},{max_tokens:280});
   const result=String(out.response||'').slice(0,3000);
   await audit(db,space,user.email,'ai.generate',task,{length:content.length});
   return response({text:result,provider:'Cloudflare Workers AI',reviewRequired:true});
  }catch{return error('ai_provider_unavailable',503);}
 }
 return null;
}
