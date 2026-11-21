export const BLOCK_TYPES=['heading','paragraph','image','quote','button','feature','global'];
const fields=['text','src','alt','url','label','eyebrow','size','componentId'];
export function safeFilename(value) {return String(value||'image').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,128)||'image';}
export function normalizePage(input={}) {
  const src=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const blocks=Array.isArray(src.blocks)?src.blocks.slice(0,101).map(b=>{
    const block=b&&typeof b==='object'&&!Array.isArray(b)?b:{};
    const p=block.props&&typeof block.props==='object'&&!Array.isArray(block.props)?block.props:{};
    const props={};for(const f of fields)if(typeof p[f]==='string')props[f]=p[f].slice(0,10000);
    return {id:typeof block.id==='string'?block.id:crypto.randomUUID(),type:String(block.type||''),props};
  }):[];
  return {title:String(src.title||'').trim(),slug:String(src.slug||'').trim().toLowerCase(),locale:String(src.locale||'vi'),description:String(src.description||'').trim(),blocks};
}
export function validatePage(page) {
  const errors=[];
  if(!page.title||page.title.length>180)errors.push('title');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)||page.slug.length>100)errors.push('slug');
  if(!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(page.locale)||page.locale.length>8)errors.push('locale');
  if(page.description.length>500)errors.push('description');
  if(page.blocks.length>100)errors.push('too_many_blocks');
  const ids=new Set();
  for(const block of page.blocks){
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(block.id)||ids.has(block.id))errors.push('block_id');
    ids.add(block.id);
    if(!BLOCK_TYPES.includes(block.type))errors.push('block_type');
    for(const [key,val] of Object.entries(block.props)){
      if(!fields.includes(key)||typeof val!=='string'||val.length>10000)errors.push('block_field');
    }
    if(block.type==='global'&&!/^[a-f0-9-]{36}$/i.test(block.props.componentId||''))errors.push('global_component_id');
    if(block.props.src&&/^\/media\/[a-f0-9-]{36}$/i.test(block.props.src))errors.push('image_source');
    if(block.props.url&&!(/^\/(?!\/)[^<>]*$/.test(block.props.url)||/^https:\/\/[^<>\s]+$/i.test(block.props.url)))errors.push('button_url');
  }
  return [...new Set(errors)];
}
