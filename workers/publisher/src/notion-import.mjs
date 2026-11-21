import {fail} from './auth.mjs';
export function notionId(id){const s=String(id||'').replace(/-/g,'');if(!/^[a-f0-9]{32}$/i.test(s))fail(400,'notion_id_invalid','Invalid page ID');return s;}
export function notionMarkdown(blocks){
 const output=[];
 for(const b of blocks){
  const kind=b.type,part=b[kind]||{},value=(part.rich_text||[]).map(v=>v.plain_text||v.text?.content||'').join('');
  if(/^heading_[123]$/.test(kind))output.push('#'.repeat(Number(kind.at(-1)))+' '+value);
  else if(kind==='paragraph')output.push(value);
  else if(kind==='bulleted_list_item')output.push('- '+value);
  else if(kind==='numbered_list_item')output.push('1. '+value);
  else if(kind==='quote')output.push('> '+value);
  else if(kind==='code')output.push('~~~'+(part.language||'')+'\n'+value+'\n~~~');
  else if(kind==='divider')output.push('---');
  else output.push('[Review required: '+kind+']');
 }
 return output.join('\n\n');
}
export async function notionPagePreview({id,token,fetcher=fetch}){
 const page=notionId(id);
 if(!token)fail(503,'notion_token_missing','Notion integration token required');
 const headers={Authorization:'Bearer '+token,'Notion-Version':'2022-06-28'};
 async function get(path){const r=await fetcher('https://api.notion.com/v1/'+path,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)fail(502,'notion_read_failed','Notion page not shared with integration');return r.json();}
 const info=await get('pages/'+page);if(info.archived||info.in_trash)fail(422,'notion_archived','Archived Notion page');
 const blocks=[];let cursor;
 do{
  const query=new URLSearchParams({page_size:'100',...(cursor?{start_cursor:cursor}:{})});
  const batch=await get('blocks/'+page+'/children?'+query);
  blocks.push(...(batch.results||[]));if(blocks.length>500)fail(413,'notion_too_large','Page exceeds 500 blocks');
  cursor=batch.has_more?batch.next_cursor:null;
 }while(cursor);
 const title=Object.values(info.properties||{}).filter(v=>v.type==='title').flatMap(v=>v.title||[]).map(v=>v.plain_text||'').join('')||'Notion import';
 return {sourceType:'notion',sourceId:page,title,body:notionMarkdown(blocks),requiresReview:blocks.some(b=>b.has_children||!['heading_1','heading_2','heading_3','paragraph','bulleted_list_item','numbered_list_item','quote','code','divider'].includes(b.type))};
}
