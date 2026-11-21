// Live production sitemap verification. This runs only after exact-SHA deployment proof.
import { appendFileSync } from 'node:fs';
const base='https://duykhang68.github.io/techblogtip/';
const runId=process.env.GITHUB_RUN_ID||'local';
const summary=process.env.GITHUB_STEP_SUMMARY;
async function get(url) {
  const response=await fetch(url+(url.includes('?')?'&':'?')+'seo_check='+runId,{
    redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)
  });
  if(response.status!==200)throw Error(url+' returned HTTP '+response.status);
  return {body:await response.text(),type:response.headers.get('content-type')||''};
}
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const {body:xml,type}=await get(base+'sitemap.xml');
assert(/(?:xml|text\/plain)/i.test(type),'Unexpected sitemap Content-Type: '+type);
assert(xml.trimStart().startsWith('<?xml'),'Sitemap lacks XML declaration');
assert(/<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml),'Sitemap namespace missing');
const entries=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
assert(entries.length>0,'Empty sitemap');
assert(new Set(entries).size===entries.length,'Duplicate sitemap URLs');
const root=new URL(base);
for(const entry of entries){
 const u=new URL(entry);
 assert(u.origin===root.origin&&u.pathname.startsWith(root.pathname),'Foreign/out-of-base URL: '+entry);
 assert(!u.search&&!u.hash&&u.pathname.endsWith('/'),'Noncanonical URL: '+entry);
}
assert(entries.includes(base),'Home URL absent from sitemap');
const robots=(await get(base+'robots.txt')).body;
assert(robots.includes('Sitemap: '+base+'sitemap.xml'),'robots.txt sitemap declaration incorrect');
assert(!/Disallow:\s*\/\s*$/m.test(robots),'robots.txt disallows site root');
const samples=[base,...entries.filter(u=>u.includes('/bai-viet/')).slice(0,5)];
for(const url of [...new Set(samples)]){
 const {body:html}=await get(url);
 assert(/<html/i.test(html),'Missing HTML document: '+url);
 assert(html.includes('rel="canonical" href="'+url+'"'),'Canonical mismatch: '+url);
 assert(html.includes('content="index,follow"'),'Page not indexable: '+url);
}
const result='Sitemap live PASS: '+entries.length+' URLs; checked '+new Set(samples).size+' live HTML pages; robots and canonical PASS. Google indexing status NOT inferred.';
console.log(result);
if(summary)appendFileSync(summary,'### Production sitemap verification\n\n- '+result+'\n- Google Search Console coverage requires authenticated URL Inspection API; HTTP 200 is not proof of indexing.\n');
