import {readFileSync,readdirSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=resolve('dist'),out=resolve('artifacts/perf-audit');
mkdirSync(out,{recursive:true});
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const files=walk(root);
const assets=files.filter(f=>/\.(css|js|woff2?|webp|jpe?g|png|avif)$/i.test(f))
 .map(f=>({path:f.slice(root.length+1),bytes:statSync(f).size,gzipBytes:gzipSync(readFileSync(f)).length})).sort((a,b)=>b.bytes-a.bytes);
const pages=['index.html','archieve/index.html','bai-viet/techblogtip-100-diem-google-pagespeed-insights/index.html'];
const routes=pages.filter(f=>files.includes(join(root,f))).map(route=>{
 const html=readFileSync(join(root,route),'utf8');
 const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]).join('');
 const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map(x=>x[1]);
 return {route,htmlGzipBytes:gzipSync(html).length,inlineCssGzipBytes:gzipSync(css).length,
 scriptUrls:scripts.map(x=>x[1]),hasDeferredMedia:/data-defer-src=/.test(html)};
});
const homepage=readFileSync(join(root,'index.html'),'utf8');
const cards=[...homepage.matchAll(/<article\b[^>]*class=["'][^"']*article-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)];
const cardImages=cards.map(match=>{
 const tag=match[1].match(/<img\b[^>]*>/i)?.[0]||'';
 const attr=n=>tag.match(new RegExp('(?:^|\\s)'+n+'=["\\x27]([^"\\x27]*)'))?.[1]||null;
 return {src:attr('src'),loading:attr('loading'),fetchpriority:attr('fetchpriority'),
  width:attr('width'),height:attr('height'),deferred:tag.includes('data-defer-src=')};
});
function check(ok,message){if(!ok)throw Error('Performance regression: '+message);}
check(cards.length===1,'homepage must contain the one retained PageSpeed article card');
if(cardImages[0].src)check(cardImages[0].loading==='eager'&&cardImages[0].fetchpriority==='high','LCP image not prioritized');
cardImages.forEach((im,i)=>{if(!im.src)return;check(im.width&&im.height,'image geometry missing');
 if(i>0)check(im.loading==='lazy'&&!im.deferred,'card thumbnails must be native lazy');});
check(homepage.includes('Be+Vietnam+Pro'),'production font family unexpectedly changed');
const cache=[];
for(const url of ['https://duykhang68.github.io/techblogtip/','https://duykhang68.github.io/techblogtip/favicon.svg']){
 try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(8000)});
 cache.push({url,status:r.status,cacheControl:r.headers.get('cache-control'),age:r.headers.get('age'),etag:r.headers.get('etag')});}
 catch(e){cache.push({url,error:String(e)});}
}
const data={routes,cardImages,assets,cache};
writeFileSync(join(out,'report.json'),JSON.stringify(data,null,2));
const kb=n=>(n/1024).toFixed(1)+' KiB';
let md='# TechBlogTip performance audit\n\n| Route | HTML gzip | Inline CSS gzip | JS requests | Deferred media |\n|---|---:|---:|---:|---|\n';
routes.forEach(r=>md+='| '+r.route+' | '+kb(r.htmlGzipBytes)+' | '+kb(r.inlineCssGzipBytes)+' | '+r.scriptUrls.length+' | '+r.hasDeferredMedia+' |\n');
md+='\n## Largest static assets\n\n| Path | Raw | Gzip |\n|---|---:|---:|\n';
assets.slice(0,20).forEach(a=>md+='| '+a.path+' | '+kb(a.bytes)+' | '+kb(a.gzipBytes)+' |\n');
md+='\n## CDN cache headers (read-only)\n\n';
cache.forEach(c=>md+='- '+c.url+': '+(c.error||('HTTP '+c.status+', Cache-Control '+(c.cacheControl||'unspecified')))+'\n');
md+='\nNo CDN cache headers are changed by this PR. GitHub Pages manages public response headers.\n';
writeFileSync(join(out,'report.md'),md);console.log(md);
