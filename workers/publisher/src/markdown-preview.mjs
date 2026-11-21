import { fail } from './auth.mjs';

// Preview only: returns structured text and vetted URLs, never HTML. Content
// is deliberately rendered using createElement/textContent in the client.
const BLOG='https://duykhang68.github.io/techblogtip/';
const MAX_BODY=100000;
const MAX_BLOCKS=600;
const MAX_COLUMNS=10;
const MAX_ROWS=80;
const INLINE=/(!\[([^\]\n]{1,180})\]\(([^)\s]{1,500})\)|\[([^\]\n]{1,180})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,500})\*\*|\*([^*\n]{1,500})\*|`([^`\n]{1,500})`)/g;

function safeURL(raw,media=false){
  const input=String(raw||'').trim();
  if(!input||/[\u0000-\u001f\u007f\\]/.test(input))return null;
  try{
    const url=new URL(input.startsWith('/')&&!input.startsWith('/techblogtip/')?
      '/techblogtip'+input:input,BLOG);
    if(url.username||url.password)return null;
    if(media){
      if(url.origin!==new URL(BLOG).origin||
         !url.pathname.startsWith('/techblogtip/')||
         !/\.webp$/i.test(url.pathname)||url.search||url.hash)return null;
    }else if(url.protocol!=='https:'&&url.protocol!=='mailto:')return null;
    if(!media&&url.origin===new URL(BLOG).origin&&
       url.protocol==='https:'&&!url.pathname.startsWith('/techblogtip/'))return null;
    return url.href;
  }catch{return null;}
}
export function previewInline(value){
  const source=String(value??'').slice(0,20000),result=[];
  let from=0;
  for(const match of source.matchAll(INLINE)){
    const at=match.index||0;
    if(at>from)result.push({type:'text',text:source.slice(from,at)});
    let token;
    if(match[2]!==undefined){
      const src=safeURL(match[3],true);
      token=src?{type:'image',src,alt:match[2]}:
        {type:'text',text:'[Ảnh chưa được nhập vào WebP nội bộ: '+match[2]+']'};
    }else if(match[4]!==undefined){
      const href=safeURL(match[5]);
      token=href?{type:'link',text:match[4],href}:
        {type:'text',text:match[4]+' ('+match[5]+')'};
    }else if(match[6]!==undefined)token={type:'strong',text:match[6]};
    else if(match[7]!==undefined)token={type:'em',text:match[7]};
    else token={type:'code',text:match[8]};
    result.push(token);from=at+match[0].length;
  }
  if(from<source.length)result.push({type:'text',text:source.slice(from)});
  return result.length?result:[{type:'text',text:source}];
}
const isLine=(line)=>/^\s*(?:#{1,3}\s|[-*+]\s|\d{1,3}\.\s|>\s?|`{3}|-{3,}\s*$)/.test(line);
function splitCells(line){
  let text=line.trim();
  if(text.startsWith('|'))text=text.slice(1);
  if(text.endsWith('|'))text=text.slice(0,-1);
  return text.split('|').map(x=>x.trim()).slice(0,MAX_COLUMNS);
}
function tableDelimiter(line){
  const parts=splitCells(line);
  return parts.length>=2&&parts.every(part=>/^:?-{3,}:?$/.test(part));
}
export function parsePublisherPreview(body){
  if(typeof body!=='string'||body.length>MAX_BODY||body.includes('\u0000'))
    fail(422,'preview_invalid','Preview requires a text body of at most 100000 characters');
  const lines=body.replace(/\r\n?/g,'\n').split('\n'),blocks=[];
  const add=block=>{if(blocks.length>=MAX_BLOCKS)
    fail(413,'preview_too_large','Too many preview blocks');blocks.push(block);};
  for(let i=0;i<lines.length;){
    const line=lines[i],trim=line.trim();
    if(!trim){i++;continue;}
    const fence=/^\s*`{3}([A-Za-z0-9+#-]{0,32})\s*$/.exec(line);
    if(fence){
      i++;const code=[];
      while(i<lines.length&&!/^\s*`{3}\s*$/.test(lines[i])){
        code.push(lines[i]);i++;
      }
      if(i<lines.length)i++;
      add({type:'code_block',language:fence[1],text:code.join('\n').slice(0,20000)});
      continue;
    }
    const heading=/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if(heading){
      add({type:'heading',level:heading[1].length,inlines:previewInline(heading[2])});
      i++;continue;
    }
    if(/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trim)){
      add({type:'rule'});i++;continue;
    }
    if(i+1<lines.length&&trim.includes('|')&&tableDelimiter(lines[i+1])){
      const headers=splitCells(line),rows=[];
      i+=2;
      while(i<lines.length&&lines[i].trim().includes('|')&&rows.length<MAX_ROWS){
        const cells=splitCells(lines[i]);
        rows.push(cells.slice(0,headers.length).map(previewInline));i++;
      }
      add({type:'table',headers:headers.map(previewInline),rows});
      continue;
    }
    if(/^>\s?/.test(trim)){
      const text=[];
      while(i<lines.length&&/^\s*>\s?/.test(lines[i])){
        text.push(lines[i].replace(/^\s*>\s?/,'').trim());i++;
      }
      add({type:'blockquote',inlines:previewInline(text.join(' '))});continue;
    }
    const list=/^\s*([-*+]|\d{1,3}\.)\s+/.exec(line);
    if(list){
      const ordered=/\d/.test(list[1]),items=[];
      while(i<lines.length){
        const current=/^\s*([-*+]|\d{1,3}\.)\s+(.+)$/.exec(lines[i]);
        if(!current||(/\d/.test(current[1])!==ordered))break;
        items.push(previewInline(current[2]));i++;
        if(items.length>=100)break;
      }
      add({type:ordered?'ordered_list':'unordered_list',items});continue;
    }
    const image=/^!\[([^\]\n]{1,180})\]\(([^)\s]{1,500})\)$/.exec(trim);
    if(image){
      const src=safeURL(image[2],true);
      add(src?{type:'image',src,alt:image[1]}:
        {type:'notice',text:'Ảnh "'+image[1]+'" phải được nhập vào WebP nội bộ trước khi xuất bản.'});
      i++;continue;
    }
    const paragraph=[trim];i++;
    while(i<lines.length&&lines[i].trim()&&!isLine(lines[i])&&
        !(i+1<lines.length&&tableDelimiter(lines[i+1]))){
      paragraph.push(lines[i].trim());i++;
    }
    add({type:'paragraph',inlines:previewInline(paragraph.join(' '))});
  }
  return {blocks,wordCount:body.trim()?body.trim().split(/\s+/u).length:0,
    limited:true,format:'safe-markdown-preview-v1'};
}
