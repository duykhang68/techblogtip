import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const expect=['index.html','robots.txt','rss.xml','sitemap.xml','search-index.json','release.json','chuyen-muc/index.html','chu-de/index.html','the/index.html','tim-kiem/index.html','404.html'];
for(const path of expect)if(!existsSync(resolve('dist',path)))throw new Error('Missing dist/'+path);
const html=readFileSync('dist/index.html','utf8');
const production=process.env.PUBLIC_INDEXABLE==='true';
if(!html.includes('lang="vi"'))throw new Error('Vietnamese language marker missing');
if(!html.includes(production?'index,follow':'noindex,nofollow'))
  throw new Error(production?'Production must be indexable':'Staging must remain noindex');
const robots=readFileSync('dist/robots.txt','utf8');
if(!robots.includes(production?'Allow: /':'Disallow: /'))
  throw new Error('Robots policy does not match build environment');
const sitemap=readFileSync('dist/sitemap.xml','utf8');
if(!sitemap.includes('<urlset'))throw new Error('Sitemap malformed');
const index=JSON.parse(readFileSync('dist/search-index.json','utf8'));
if(!Array.isArray(index)||index.length<8)throw new Error('Search index empty or malformed');
if(!index.every(x=>x.title&&x.url&&x.category))throw new Error('Search index entries invalid');
const release=JSON.parse(readFileSync('dist/release.json','utf8'));
const sha=process.env.SOURCE_SHA || process.env.GITHUB_SHA;
if(process.env.GITHUB_ACTIONS==='true' && release.sha!==sha)throw new Error('Built release SHA mismatch');
console.log('Verified HTML, RSS, sitemap, noindex, search index and exact SHA marker');
