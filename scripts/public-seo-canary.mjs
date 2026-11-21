// Read-only post-deploy canary. This does not infer Google index coverage.
const base='https://duykhang68.github.io/techblogtip/';
const expected=process.env.EXPECTED_SHA||'';
async function get(path){
 const response=await fetch(new URL(path,base),{headers:{'user-agent':'TechBlogTip-PostDeploy-QA/1.0'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(path+' HTTP '+response.status);
 return response.text();
}
function ensure(condition,message){if(!condition)throw Error(message);}
const release=JSON.parse(await get('release.json'));
ensure(/^[a-f0-9]{40}$/.test(release.sha||''),'Missing public exact SHA');
if(expected)ensure(release.sha===expected,'Production SHA '+release.sha+' differs from expected '+expected);
const robots=await get('robots.txt');
ensure(robots.includes('sitemap.xml'),'robots.txt missing sitemap reference');
const sitemap=await get('sitemap.xml');
ensure(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),'Bad sitemap namespace');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
ensure(urls.length>0,'Empty sitemap');
ensure(urls.length===new Set(urls).size,'Duplicate sitemap URLs');
for(const url of urls){
 const parsed=new URL(url);
 ensure(parsed.origin===new URL(base).origin&&parsed.pathname.startsWith('/techblogtip/'),'Foreign sitemap URL: '+url);
}
for(const url of [base,...urls.filter(u=>u!==base).slice(0,10)]){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 ensure(response.ok,'Published URL unavailable: '+url+' HTTP '+response.status);
 const html=await response.text();
 ensure(!/name="robots" content="noindex/i.test(html),'Unexpected noindex: '+url);
}
console.log(JSON.stringify({check:'public-seo-canary',status:'PASS',releaseSha:release.sha,sitemapUrls:urls.length,liveUrlsChecked:Math.min(10,urls.length)+1,indexedByGoogle:'not_measured'}));
