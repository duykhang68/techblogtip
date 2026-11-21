import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';

const dist=resolve(process.env.SEO_AUDIT_DIST||'dist');
const pages=process.env.DEPLOY_TARGET==='github-pages';
const origin=pages?'https://duykhang68.github.io/techblogtip/':
  String(process.env.SITE_URL||'https://techblogtip-staging.tamsudev-com.workers.dev/').replace(/\/?$/,'/');
const read=path=>readFileSync(join(dist,path),'utf8');
function assert(condition,message){if(!condition)throw Error('SEO gate: '+message);}
function pagesUnder(folder){
 const found=[];
 if(!existsSync(folder))return found;
 for(const entry of readdirSync(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);
  if(entry.isDirectory())found.push(...pagesUnder(path));
  else if(entry.name==='index.html')found.push(path);
 }
 return found;
}
export function auditHtml(html,canonical,production){
 assert(/<html[^>]+lang="vi"/.test(html),'missing Vietnamese lang');
 assert(html.includes('name="description"'),'missing meta description');
 assert(html.includes('rel="canonical" href="'+canonical+'"'),'canonical mismatch '+canonical);
 assert(html.includes('name="robots" content="'+(production?'index,follow':'noindex,nofollow')+'"'),'incorrect robots directive');
 assert(!html.includes('name="google-site-verification"')||production,'staging must not contain GSC tag');
 const titles=[...html.matchAll(/<title>([^<]+)<\/title>/g)];
 assert(titles.length===1 && titles[0][1].trim().length>0,'missing or duplicated title');
}
export function auditCmsAdminHtml(html){
 assert(/<html[^>]+lang="vi"/.test(html),'CMS admin missing Vietnamese lang');
 const titles=[...html.matchAll(/<title>([^<]+)<\/title>/g)];
 assert(titles.length===1 && titles[0][1].trim().length>0,'CMS admin missing or duplicated title');
 assert(html.includes('name="robots" content="noindex,nofollow"'),'CMS admin must always be noindex');
 assert(html.includes('id="google-login"'),'CMS admin Google Sign-In missing');
 assert(!html.includes('name="google-site-verification"'),'CMS admin must not contain Search Console verification');
}
export function auditSitemap(xml,origin,paths){
 const entries=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1].replaceAll('&amp;','&'));
 assert(entries.length>0,'empty sitemap');
 assert(entries.length===new Set(entries).size,'duplicate sitemap URLs');
 for(const url of entries){
  assert(url.startsWith(origin),'external or wrong-base sitemap URL: '+url);
  assert(!url.includes('staging.tamsudev-com.workers.dev')||origin.includes('staging.'),'staging URL inside production sitemap');
 }
 for(const route of paths)assert(entries.includes(new URL(route,origin).toString()),'missing indexable sitemap route '+route);
 return entries.length;
}
function main(){
 const root=read('index.html'),robots=read('robots.txt'),sitemap=read('sitemap.xml');
 const files=pagesUnder(dist);
 assert(files.length>0,'no pages to audit');
 const prefix=pages?'/techblogtip/':'/';
 for(const path of files){
  const rel=path.slice(dist.length+1).replaceAll('\\','/');
  const route=rel==='index.html'?'':rel.replace(/index\.html$/,'');
  // Private CMS routes have an explicit security/SEO policy, rather than
  // bypassing checks or being treated as public indexable blog articles.
  try{
   const html=readFileSync(path,'utf8');
   if(rel==='tools/cms/index.html')auditCmsAdminHtml(html);
   else auditHtml(html,new URL(route,origin).toString(),pages);
  }catch(error){
   throw Error(rel+': '+error.message);
  }
 }
 const keyRoutes=['','chuyen-muc/','the/','chu-de/'];
 const count=auditSitemap(sitemap,origin,keyRoutes);
 assert(!sitemap.includes('<loc>'+new URL('tools/cms/',origin).toString()+'</loc>'),'CMS admin must not appear in sitemap');
 // A sitemap can be syntactically valid but contain 404 pages. Verify each
 // declared absolute URL against the actual generated static HTML output.
 assert(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),'missing XML prolog');
 assert(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap),'invalid sitemap namespace');
 assert(!/<priority>|<changefreq>/.test(sitemap),'unsupported speculative sitemap hints');
 const entries=[...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)];
 assert(entries.length===count,'malformed XML URL elements');
 for(const [,encodedUrl,lastmod] of entries){
  const rawUrl=encodedUrl.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  const parsed=new URL(rawUrl);
  assert(parsed.origin===new URL(origin).origin,'sitemap contains foreign origin');
  assert(parsed.pathname.startsWith(new URL(origin).pathname),'sitemap entry outside project directory');
  assert(!parsed.search&&!parsed.hash,'sitemap must use canonical URLs');
  assert(parsed.pathname.endsWith('/'),'sitemap URL missing trailing slash');
  const relative=parsed.pathname.slice(new URL(origin).pathname.length);
  assert(existsSync(join(dist,relative,'index.html')),'sitemap URL points to a missing HTML page: '+rawUrl);
  if(lastmod)assert(!Number.isNaN(Date.parse(lastmod)) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(lastmod),'invalid sitemap lastmod: '+rawUrl);
 }
 assert(robots.includes(pages?'Allow: /':'Disallow: /'),'robots not aligned with target');
 if(pages)assert(robots.includes(origin+'sitemap.xml'),'wrong public sitemap URL');
 else assert(!root.includes('name="google-site-verification"'),'staging verification token leak');
 const token=String(process.env.PUBLIC_GSC_VERIFICATION||'');
 if(pages&&token && /^[A-Za-z0-9+/_-]{12,160}={0,2}$/.test(token))
   assert(root.includes('name="google-site-verification" content="'+token+'"'),'configured Search Console token absent');
 console.log('SEO gate PASS: '+files.length+' HTML pages and '+count+' sitemap URLs; '+(pages?'GitHub Pages indexable':'staging noindex'));
}
if(process.argv[1] && import.meta.url===new URL('file://'+resolve(process.argv[1])).href)main();
