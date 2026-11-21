const cache=new Map();
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const emails=s=>String(s||'').trim().toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
export async function googleUser(req,env){
  const clientId=String(env.GOOGLE_CLIENT_ID||'');
  if(!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error('google_oauth_not_configured');
  const auth=req.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token||token.length>10000)throw Error('login_required');
  const parts=token.split('.');
  if(parts.length!==3)throw Error('invalid_identity');
  let header,payload;
  try{header=JSON.parse(new TextDecoder().decode(bytes(parts[0])));payload=JSON.parse(new TextDecoder().decode(bytes(parts[1])));}
  catch{throw Error('invalid_identity');}
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('invalid_identity');
  const now=Math.floor(Date.now()/1000);
  if(!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)
    ||payload.aud!==clientId||!Number.isFinite(payload.exp)||payload.exp<=now
    ||(payload.nbf&&payload.nbf>now+30)||!['true',true].includes(payload.email_verified))throw Error('invalid_identity');
  const url='https://www.googleapis.com/oauth2/v3/certs';
  let jwks=cache.get(url);
  if(!jwks||jwks.expires<Date.now()){
    const result=await fetch(url);
    if(!result.ok)throw Error('google_jwks_unavailable');
    const data=await result.json();
    jwks={keys:data.keys||[],expires:Date.now()+300000};
    cache.set(url,jwks);
  }
  const jwk=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig'));
  if(!jwk)throw Error('invalid_identity');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if(!verified)throw Error('invalid_identity');
  const email=String(payload.email||'').toLowerCase().trim();
  const admins=emails(env.CMS_ADMINS),editors=emails(env.CMS_EDITORS),reviewers=emails(env.CMS_REVIEWERS);
  const role=admins.includes(email)?'admin':editors.includes(email)?'editor':reviewers.includes(email)?'reviewer':null;
  if(!role)throw Error('not_allowed');
  return {email,role};
}
