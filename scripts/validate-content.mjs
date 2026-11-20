import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve('src/content/articles');
const files=readdirSync(root).filter(n=>n.endsWith('.md'));
if(files.length===0)throw new Error('No Markdown content');
const seen=new Set();
let problems=[];
for(const file of files){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file))problems.push(file+': invalid slug filename');
 const source=readFileSync(resolve(root,file),'utf8');
 const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
 if(!match){problems.push(file+': missing frontmatter');continue;}
 const data=match[1];
 const get=(key)=>data.match(new RegExp('^'+key+':\\s*(.+)$','m'))?.[1]?.trim();
 for(const key of ['title','description','published','category','author'])if(!get(key))problems.push(file+': missing '+key);
 const desc=get('description')?.replace(/^["']|["']$/g,'')||'';
 if(desc.length<25||desc.length>200)problems.push(file+': description must be 25-200 characters');
 const date=get('published');if(date&&!Number.isFinite(Date.parse(date.replace(/["']/g,''))))problems.push(file+': invalid date');
 if(get('cover')&&!/\.webp['"]?$/.test(get('cover')))problems.push(file+': cover must be WebP');
 if(get('cover')&&!get('coverAlt'))problems.push(file+': coverAlt required');
 if(/!\[[^\]]*\]\([^)]*\.(?:jpe?g|png|gif)(?:\?|\))/i.test(source))problems.push(file+': content image must be WebP');
 if(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s)]+/i.test(source)&&/!\[[^\]]*\]/.test(source))problems.push(file+': do not hotlink Google Drive media');
 if(seen.has(file))problems.push(file+': duplicate');seen.add(file);
}
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log('Validated '+files.length+' Markdown articles');
