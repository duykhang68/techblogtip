// Verify the public GitHub Pages *project* path, not a staging Worker.
const expected='https://duykhang68.github.io/techblogtip/';
const raw=String(process.env.PRODUCTION_URL||'').trim();
const sha=String(process.env.SOURCE_SHA||process.env.GITHUB_SHA||'');
if(raw!==expected||!/^[a-f0-9]{40}$/.test(sha))
  throw new Error('Production must be the approved GitHub Pages project and exact SHA');
const root=expected.slice(0,-1);
async function fetchEvidence(path){
  const response=await fetch(root+path+'?check='+Date.now(),{
    redirect:'manual',headers:{'Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(12000),
  });
  if(response.status!==200)throw new Error('Public production HTTP '+response.status+' at '+path);
  return response.text();
}
let last;
for(let attempt=1;attempt<=6;attempt++){
  try{
    const marker=JSON.parse(await fetchEvidence('/release.json'));
    if(marker.project!=='techblogtip'||marker.ref!=='main'||marker.sha!==sha)
      throw new Error('Pages release marker does not match main SHA');
    const html=await fetchEvidence('/');
    if(!html.includes('content="index,follow"')||
       !html.includes('href="'+expected+'"')||
       !html.includes('href="/techblogtip/favicon.svg"'))
      throw new Error('GitHub Pages homepage canonical or base assets incorrect');
    const robots=await fetchEvidence('/robots.txt');
    if(!robots.includes('Allow: /')||robots.includes('Disallow: /')||
       !robots.includes(expected+'sitemap.xml'))
      throw new Error('GitHub Pages indexability or sitemap invalid');
    console.log('Verified GitHub Pages project release at exact SHA '+sha);
    process.exit(0);
  }catch(err){last=err;console.warn('GitHub Pages verification attempt '+attempt+' not yet valid');}
  if(attempt<6)await new Promise(r=>setTimeout(r,2000*attempt));
}
throw new Error('GitHub Pages production release verification failed: '+(last?.message||'unknown'));
