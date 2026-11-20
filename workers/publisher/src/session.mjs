import { PublisherError,fail } from './auth.mjs';

// 7-day same-browser login. The Google ID token is NEVER persisted in web storage.
// The worker signs short-lived identity claims using a purpose-separated HKDF key
// from the already configured high-entropy publisher token. A dedicated optional
// SESSION_SIGNING_KEY secret can be used instead; rotating either signs out sessions.
const COOKIE_NAME='tbt_editor_session';
export const SESSION_TTL_SECONDS=7*24*60*60;
const text=new TextEncoder();
const decoder=new TextDecoder();
function encode(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  let string='';
  for(const byte of bytes)string+=String.fromCharCode(byte);
  return btoa(string).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(encoded){
  if(typeof encoded!=='string'||!encoded||encoded.length>4096||!/^[a-zA-Z0-9_-]+$/.test(encoded))
    fail(401,'session_invalid','Invalid editor session');
  try{
    const padded=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
    return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
  }catch{fail(401,'session_invalid','Invalid editor session');}
}
async function signingKey(env){
  const material=String(env.SESSION_SIGNING_KEY||env.GITHUB_PUBLISHER_TOKEN||'');
  if(material.length<20)fail(503,'session_unconfigured','Session signing key is missing');
  const master=await crypto.subtle.importKey('raw',text.encode(material),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',
    salt:text.encode('TechBlogTip-Publisher-v1'),
    info:text.encode('HttpOnly-Session-HMAC-SHA256'),
  },master,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
}
function cookie(value,maxAge){
  return COOKIE_NAME+'='+value+'; Path=/; Max-Age='+maxAge+'; HttpOnly; Secure; SameSite=Strict';
}
export function expiredSessionCookie(){
  return cookie('',0);
}
export async function issueSessionCookie(env,identity,now=Math.floor(Date.now()/1000)){
  if(!identity||typeof identity.email!=='string'||typeof identity.subject!=='string')
    fail(401,'session_invalid','Invalid editor identity');
  const claims={v:1,e:identity.email.trim().toLowerCase(),s:identity.subject,iat:now,exp:now+SESSION_TTL_SECONDS};
  const body=encode(text.encode(JSON.stringify(claims)));
  const mac=encode(await crypto.subtle.sign('HMAC',await signingKey(env),text.encode(body)));
  return cookie(body+'.'+mac,SESSION_TTL_SECONDS);
}
export async function verifySession(request,env,now=Math.floor(Date.now()/1000)){
  const cookieHeader=request.headers.get('Cookie')||'';
  const found=cookieHeader.split(';').map(p=>p.trim()).find(p=>p.startsWith(COOKIE_NAME+'='));
  if(!found)fail(401,'not_authenticated','Sign in with Google to continue');
  const value=found.slice(COOKIE_NAME.length+1);
  if(value.length>4096)fail(401,'session_invalid','Invalid editor session');
  const parts=value.split('.');
  if(parts.length!==2)fail(401,'session_invalid','Invalid editor session');
  const key=await signingKey(env);
  const valid=await crypto.subtle.verify('HMAC',key,decode(parts[1]),text.encode(parts[0]));
  if(!valid)fail(401,'session_invalid','Editor session signature rejected');
  let claims;
  try{claims=JSON.parse(decoder.decode(decode(parts[0])));}catch{fail(401,'session_invalid','Invalid editor session');}
  if(claims?.v!==1||typeof claims.e!=='string'||typeof claims.s!=='string'||!claims.s||
    !Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||
    claims.iat>now+120||claims.exp<=now||claims.exp-claims.iat!==SESSION_TTL_SECONDS)
    fail(401,'session_expired','Editor session expired or invalid');
  const email=claims.e.trim().toLowerCase();
  const allowed=new Set(String(env.ALLOWED_EDITORS||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean));
  if(!allowed.has(email))fail(403,'not_editor','Editor permission was revoked');
  return {email,subject:claims.s,expiresAt:claims.exp};
}
