// Fail closed after a manually approved production deployment.
const raw=String(process.env.PRODUCTION_URL||'').trim();
const sha=String(process.env.SOURCE_SHA||process.env.GITHUB_SHA||'');
const url=new URL(raw);
if(url.protocol!=='https:'||!url.hostname.includes('.')||
   url.hostname.endsWith('.workers.dev')||url.hostname.endsWith('.pages.dev')||
   url.port||url.pathname!=='/'||url.search||url.hash||
   !/^[a-f0-9]{40}$/.test(sha))
  throw new Error('Dedicated production hostname and exact source SHA required');
const base=url.origin;
async function fetchEvidence(path){
  const res=await fetch(base+path,{
    redirect:'manual',headers:{'Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(12000),
  });
  if(res.status!==200)throw new Error('Public production HTTP '+res.status+' at '+path);
  return res.text();
}
let error;
for(let attempt=1;attempt<=5;attempt++){
  try{
    const marker=JSON.parse(await fetchEvidence('/release.json'));
    if(marker.sha!==sha||marker.ref!=='main'||marker.project!=='techblogtip')
      throw new Error('Production marker mismatch with main SHA');
    const home=await fetchEvidence('/');
    if(!home.includes('content="index,follow"')||
       !home.includes('href="'+base+'/"'))
      throw new Error('Production homepage must be indexable and canonical');
    const robots=await fetchEvidence('/robots.txt');
    if(!robots.includes('Allow: /')||robots.includes('Disallow: /'))
      throw new Error('Production robots rules are not indexable');
    console.log('Verified production public release and exact SHA '+sha);
    process.exit(0);
  }catch(e){error=e;console.warn('Production verification attempt '+attempt+' incomplete');}
  if(attempt<5)await new Promise(r=>setTimeout(r,2000*attempt));
}
throw new Error('Production verification failed: '+(error?.message||'unknown'));
