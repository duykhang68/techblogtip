/**
 * Google Identity Services verifier. Every request is authorized against a
 * real Google-signed RS256 ID token. Never trust an unsigned JWT payload.
 */
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com','https://accounts.google.com']);
export class PublisherError extends Error {
  constructor(status,code,message){super(message);this.name='PublisherError';this.status=status;this.code=code;}
}
export function fail(status,code,message){throw new PublisherError(status,code,message);}
function bytes(encoded){
  if(typeof encoded!=='string'||!encoded||!/^[A-Za-z0-9_-]+$/.test(encoded))fail(401,'bad_token','Invalid identity token');
  try {
    const b64=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
    return Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  }catch {fail(401,'bad_token','Invalid identity token');}
}
function parsePart(encoded){
  try{return JSON.parse(new TextDecoder().decode(bytes(encoded)));}catch {fail(401,'bad_token','Invalid identity token');}
}
export async function verifyGoogleIdToken(token,clientId,allowlist,fetcher=fetch,now=Math.floor(Date.now()/1000)){
  if(!clientId||!allowlist)fail(503,'oauth_not_configured','Google OAuth settings missing');
  if(typeof token!=='string'||token.length>12000)fail(401,'bad_token','Identity token missing or oversized');
  const parts=token.split('.');
  if(parts.length!==3)fail(401,'bad_token','Identity token malformed');
  const header=parsePart(parts[0]),claims=parsePart(parts[1]);
  if(header?.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128)
    fail(401,'bad_token','Unsupported token signature');
  if(!ISSUERS.has(claims?.iss)||claims.aud!==clientId||
    !Number.isInteger(claims.exp)||claims.exp<=now||
    !Number.isInteger(claims.iat)||claims.iat>now+120||claims.iat<now-7200||
    (claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>now+120))||
    typeof claims.sub!=='string'||!claims.sub||
    claims.email_verified!==true||typeof claims.email!=='string')
    fail(401,'invalid_claims','Google identity claims rejected');
  let jwks;
  try {
    const response=await fetcher(JWKS_URL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('JWKS fetch rejected');
    const data=await response.json();jwks=data.keys;
  } catch {fail(503,'google_keys_unavailable','Cannot retrieve Google signing keys');}
  const jwk=Array.isArray(jwks)?jwks.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256')):null;
  if(!jwk)fail(401,'bad_token','Google signing key not found');
  try {
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),signed))
      fail(401,'bad_token','Invalid Google signature');
  }catch(e){if(e instanceof PublisherError)throw e;fail(401,'bad_token','Google signature verification failed');}
  const email=claims.email.trim().toLowerCase();
  const allowed=new Set(allowlist.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  if(!allowed.has(email))fail(403,'not_editor','Google account is not an authorized TechBlogTip editor');
  return {email,subject:claims.sub};
}
export function requireSameOrigin(request) {
  if(!['POST','PUT','DELETE','PATCH'].includes(request.method))return;
  const expected=new URL(request.url).origin;
  const origin=request.headers.get('Origin');
  if(origin!==expected)fail(403,'origin_denied','Cross-origin publication requests are disabled');
  const site=request.headers.get('Sec-Fetch-Site');
  if(site&&site!=='same-origin')fail(403,'origin_denied','Cross-site publication is disabled');
}
