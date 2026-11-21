import {fail} from './auth.mjs';
export function safeVaultPath(path){
 const p=String(path||'').replace(/\\/g,'/');
 if(!p||p.startsWith('/')||p.split('/').some(x=>x==='..'||x==='.')||/[\x00-\x1f]/.test(p))fail(400,'vault_path_invalid','Unsafe vault path');
 return p;
}
export function obsidianPreview({path,markdown,attachments=[]}){
 const sourceId=safeVaultPath(path);
 if(!/\.md$/i.test(sourceId))fail(422,'note_invalid','Select a Markdown note');
 if(typeof markdown!=='string'||markdown.length>150000)fail(413,'note_too_large','Note exceeds 150k characters');
 const metadata={};let body=markdown.replace(/\r\n?/g,'\n');
 if(body.startsWith('---\n')){
  const end=body.indexOf('\n---\n',4);
  if(end<0||end>10000)fail(422,'frontmatter_invalid','Invalid frontmatter');
  for(const line of body.slice(4,end).split('\n')){const m=/^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);if(m)metadata[m[1]]=m[2];}
  body=body.slice(end+5);
 }
 const assets=[];const unresolvedLinks=[];const known=new Set(attachments.map(safeVaultPath));
 body=body.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,src,alt)=>{const file=safeVaultPath(src);assets.push(file);return '[Media import required: '+(alt||file)+']';});
 body=body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label)=>{unresolvedLinks.push(target);return label||target;});
 if(/<\s*script\b|\]\(\s*(javascript|data):/i.test(body))fail(422,'unsafe_note','Unsafe note content');
 return {sourceType:'obsidian',sourceId,title:metadata.title||sourceId.split('/').at(-1).replace(/\.md$/i,''),body,metadata,attachments:assets,missingAttachments:assets.filter(a=>!known.has(a)),unresolvedLinks,requiresReview:assets.length>0||unresolvedLinks.length>0};
}
