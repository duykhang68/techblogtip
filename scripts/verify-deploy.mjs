const base=(process.env.STAGING_URL||'').replace(/\/$/,'');
const sha=process.env.SOURCE_SHA || process.env.GITHUB_SHA;
if(!base||!/^https:\/\//.test(base))throw new Error('STAGING_URL must be https');
if(!/^[0-9a-f]{40}$/.test(sha||''))throw new Error('SOURCE_SHA must be a 40-character commit SHA');
async function fetchText(path){
 const response=await fetch(base+path+(path.includes('?')?'&':'?')+'verify='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('HTTP '+response.status+' at '+path);
 return response.text();
}
let last;
for(let attempt=1;attempt<=5;attempt++){
 try{
  const release=JSON.parse(await fetchText('/release.json'));
  if(release.sha!==sha)throw new Error('Public SHA '+release.sha+' does not match source '+sha);
  const html=await fetchText('/');
  if(!/name="robots"[^>]*noindex,nofollow/.test(html))throw new Error('Staging homepage lost noindex');
  console.log('Verified public staging '+base+' at exact SHA '+sha);
  process.exit(0);
 }catch(error){last=error;console.warn('Verify attempt '+attempt+': '+error.message);if(attempt<5)await new Promise(r=>setTimeout(r,2500*attempt));}
}
throw last;
