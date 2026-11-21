// Bounded read-only GraphQL Content Delivery subset. No mutations/subscriptions/fragments.
import {expandedBlocks} from './enterprise.mjs';
const err=(message,status=400)=>new Response(JSON.stringify({errors:[{message}]}),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const send=data=>new Response(JSON.stringify({data}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60','access-control-allow-origin':'*'}});
const fieldNames={root:new Set(['page','pages']),page:new Set(['id','slug','locale','title','description','publishedAt','blocks']),block:new Set(['id','type','props']),props:new Set(['text','label','src','alt','url','eyebrow','size'])};
function parser(source){
 if(source.length>4096)throw Error('query_too_large');
 const input=source.replace(/#[^\n]*/g,'');
 const pattern=/"(?:[^"\\]|\\.)*"|[_A-Za-z][_A-Za-z0-9]*|\d+|[{}():,]/g;
 const tokens=[...input.matchAll(pattern)].map(m=>({text:m[0],index:m.index}));
 if(tokens.length>200)throw Error('too_many_tokens');
 let cursor=0,previous=0;
 for(const token of tokens){if(input.slice(previous,token.index).trim())throw Error('unsupported_graphql_syntax');previous=token.index+token.text.length;}
 if(input.slice(previous).trim())throw Error('unsupported_graphql_syntax');
 const peek=()=>tokens[cursor]?.text,take=()=>tokens[cursor++]?.text;
 const expect=t=>{if(take()!==t)throw Error('expected_'+t);};
 function value(){const t=take();if(!t)throw Error('missing_value');if(t.startsWith('"')){try{return JSON.parse(t);}catch{throw Error('invalid_string');}}if(/^\d+$/.test(t))return Number(t);if(t==='true')return true;if(t==='false')return false;throw Error('unsupported_value');}
 function selection(parent,depth=0){
  if(depth>4)throw Error('query_too_deep');
  expect('{');const result=[];
  while(peek()&&peek()!=='}'){
   const name=take();
   if(!fieldNames[parent].has(name))throw Error('unknown_field_'+name);
   const args={};
   if(peek()==='('){take();while(peek()&&peek()!==')'){const key=take();expect(':');if(!['space','locale','slug','limit'].includes(key))throw Error('unknown_argument_'+key);args[key]=value();if(peek()===',')take();}expect(')');}
   const type=parent==='root'?'page':parent==='page'&&name==='blocks'?'block':parent==='block'&&name==='props'?'props':null;
   const children=peek()==='{'?selection(type||'props',depth+1):null;
   if(type&&!children)throw Error('selection_required_'+name);
   if(!type&&children)throw Error('selection_not_allowed_'+name);
   result.push({name,args,children});
   if(result.length>30)throw Error('selection_too_large');
  }
  expect('}');return result;
 }
 if(peek()==='query'){take();if(peek()!=='{')take();}
 const ast=selection('root');if(cursor!==tokens.length)throw Error('unexpected_tokens');return ast;
}
function project(value,nodes){
 if(Array.isArray(value))return value.map(v=>project(v,nodes));
 if(!value)return null;
 const obj={};for(const n of nodes){obj[n.name]=n.children?project(value[n.name],n.children):value[n.name]??null;}return obj;
}
const validSpace=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=55;
const validLocale=v=>typeof v==='string'&&/^[a-z]{2}(?:-[A-Z]{2})?$/.test(v);
const validSlug=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
async function doc(row,db,space){const data=JSON.parse(row.published_json);return {id:row.id,...data,publishedAt:row.published_at,blocks:await expandedBlocks(db,space,data.blocks||[])};}
export async function graphql(req,url,env){
 if(!env.CMS_DB)return err('database_not_bound',503);
 if(!['GET','POST'].includes(req.method))return err('method_not_allowed',405);
 let source='';
 if(req.method==='GET')source=url.searchParams.get('query')||'';
 else{
  if(Number(req.headers.get('content-length')||0)>4096)return err('query_too_large',413);
  let body;try{body=await req.text();}catch{return err('invalid_request');}
  if(body.length>4096)return err('query_too_large',413);
  try{source=String(JSON.parse(body).query||'');}catch{return err('invalid_json');}
 }
 let ast;try{ast=parser(source);}catch(e){return err(e.message);}
 const db=env.CMS_DB,result={};
 try{
  for(const query of ast){
   const {name,args}=query,space=args.space||'default',locale=args.locale||'vi';
   if(!validSpace(space)||!validLocale(locale))return err('invalid_space_or_locale');
   if(name==='page'){
    if(!validSlug(args.slug))return err('invalid_slug');
    const row=await db.prepare("SELECT id,published_json,published_at FROM cms_pages WHERE space_id=? AND published_slug=? AND published_locale=? AND status='published' LIMIT 1").bind(space,args.slug,locale).first();
    result.page=row?project(await doc(row,db,space),query.children):null;
   }else{
    const limit=args.limit===undefined?10:Number(args.limit);
    if(!Number.isInteger(limit)||limit<1||limit>20)return err('invalid_limit');
    const rows=await db.prepare("SELECT id,published_json,published_at FROM cms_pages WHERE space_id=? AND published_locale=? AND status='published' ORDER BY published_at DESC LIMIT ?").bind(space,locale,limit).all();
    result.pages=project(await Promise.all((rows.results||[]).map(x=>doc(x,db,space))),query.children);
   }
  }
  return send(result);
 }catch{return err('query_failed',503);}
}
export const schemaSDL=[
 'type Query {',
 ' page(space: String = "default", locale: String = "vi", slug: String!): Page',
 ' pages(space: String = "default", locale: String = "vi", limit: Int = 10): [Page!]!',
 '}',
 'type Page { id: ID!, slug: String!, locale: String!, title: String!, description: String, publishedAt: String, blocks: [Block!]! }',
 'type Block { id: ID!, type: String!, props: BlockProps }',
 'type BlockProps { text: String, label: String, src: String, alt: String, url: String, eyebrow: String, size: String }'
].join('\n');
