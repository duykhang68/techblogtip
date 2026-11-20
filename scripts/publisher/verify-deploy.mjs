// Refuse to mark a deployment successful without a public SHA match and denied anonymous API.
const base=(process.env.PUBLISHER_URL||'').replace(/\/$/,'');
const sha=process.env.GITHUB_SHA;
if(!/^https:\/\//.test(base)||!/^[a-f0-9]{40}$/.test(sha||''))
  throw new Error('Invalid deployment target or SHA');
async function get(url,attempt){
  return fetch(base+url+(url.includes('?')?'&':'?')+'check='+attempt,{
    headers:{'Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(10000),
  });
}
let reason='Unknown verification failure';
for(let attempt=1;attempt<=6;attempt++){
  try{
    const health=await get('/health',attempt);
    if(health.status!==200)throw new Error('Health HTTP '+health.status);
    const data=await health.json();
    if(data.releaseSha!==sha)throw new Error('Public Publisher SHA does not match deployed commit');
    const admin=await get('/admin',attempt);
    if(admin.status!==200)throw new Error('Admin HTTP '+admin.status);
    const html=await admin.text();
    if(!html.includes('noindex,nofollow'))throw new Error('Admin must remain noindex');
    const anon=await get('/api/rows',attempt);
    if(anon.status!==401)throw new Error('Anonymous API must return HTTP 401');
    console.log('Verified publisher dev Worker exact SHA, noindex and 401 anonymous access');
    process.exit(0);
  }catch(error){reason=error.message;console.warn('Verification attempt '+attempt+' failed: '+reason);}
  if(attempt<6)await new Promise(r=>setTimeout(r,3000*attempt));
}
throw new Error('Publisher dev deployment verification failed: '+reason);
