// Resume Studio private API: never store a resume in GitHub or public static files.
// Requires D1 binding DB, GOOGLE_CLIENT_ID and exact ALLOWED_ORIGIN.
const json = (value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
function base64url(raw){const s=raw.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));}
async function verifyCredential(token,clientId){
  if(typeof token!=='string'||token.length>12000)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  let header,claims;try{header=JSON.parse(new TextDecoder().decode(base64url(parts[0])));claims=JSON.parse(new TextDecoder().decode(base64url(parts[1])));}catch{return null;}
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||typeof claims.sub!=='string'||!claims.sub||claims.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss))return null;
  const now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+60||claims.exp>now+7200||claims.nbf&&claims.nbf>now+60)return null;
  const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{headers:{accept:'application/json'}});
  if(!response.ok)return null;
  const doc=await response.json();
  const jwk=doc.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig'&&k.alg==='RS256');
  if(!jwk)return null;
  try{const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const data=new TextEncoder().encode(parts[0]+'.'+parts[1]);const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),data);return valid?claims.sub:null;}catch{return null;}
}
const cors=(origin,allowed)=>({'access-control-allow-origin':origin===allowed?origin:'null','access-control-allow-methods':'GET, PUT, DELETE, OPTIONS','access-control-allow-headers':'Authorization, Content-Type, If-Match','access-control-max-age':'600','vary':'Origin'});
function validatePayload(input){
  if(!input||typeof input!=='object'||input.version!==1||!Array.isArray(input.resumes)||!Array.isArray(input.jobs)||input.resumes.length>300||input.jobs.length>1000)return false;
  const fields=['title','name','role','email','phone','location','website','summary','experience','education','skills','projects','certificates'];
  const ids=new Set();
  for(const r of input.resumes){if(!r||typeof r!=='object'||typeof r.id!=='string'||r.id.length>90||ids.has(r.id)||fields.some(f=>typeof r[f]!=='string'||r[f].length>12000))return false;ids.add(r.id);}
  for(const j of input.jobs){if(!j||typeof j!=='object'||typeof j.id!=='string'||j.id.length>90||typeof j.company!=='string'||j.company.length>160||typeof j.position!=='string'||j.position.length>180||!['Saved','Applied','Interview','Offer','Rejected'].includes(j.stage)||typeof j.notes!=='string'||j.notes.length>800||typeof j.url!=='string'||j.url.length>500||typeof j.resumeId!=='string')return false;}
  return true;
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('origin')||'';
    if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.ALLOWED_ORIGIN)return json({error:'server_not_configured'},503);
    const headers=cors(origin,env.ALLOWED_ORIGIN);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(origin!==env.ALLOWED_ORIGIN)return json({error:'origin_not_allowed'},403,headers);
    const path=new URL(request.url).pathname;
    if(path!=='/v1/state')return json({error:'not_found'},404,headers);
    const auth=request.headers.get('authorization')||'';
    if(!auth.startsWith('Bearer '))return json({error:'unauthorized'},401,headers);
    let sub;try{sub=await verifyCredential(auth.slice(7),env.GOOGLE_CLIENT_ID);}catch{return json({error:'identity_provider_unavailable'},503,headers);}
    if(!sub)return json({error:'unauthorized'},401,headers);
    if(request.method==='GET'){
      const row=await env.DB.prepare('SELECT payload, revision FROM resume_state WHERE user_sub=?').bind(sub).first();
      if(!row)return json({version:1,resumes:[],jobs:[],revision:0},200,headers);
      return json({...JSON.parse(row.payload),revision:row.revision},200,headers);
    }
    if(request.method==='PUT'){
      const declared=Number(request.headers.get('content-length')||0);
      if(declared>260000)return json({error:'too_large'},413,headers);
      let raw;try{raw=await request.text();}catch{return json({error:'bad_request'},400,headers);}
      if(raw.length>260000)return json({error:'too_large'},413,headers);
      let payload;try{payload=JSON.parse(raw);}catch{return json({error:'bad_json'},400,headers);}
      if(!validatePayload(payload))return json({error:'invalid_payload'},422,headers);
      const revision=Number(request.headers.get('if-match'));
      if(!Number.isSafeInteger(revision)||revision<0)return json({error:'revision_required'},428,headers);
      const data=JSON.stringify({version:1,resumes:payload.resumes,jobs:payload.jobs});
      if(revision===0){
        const result=await env.DB.prepare('INSERT INTO resume_state(user_sub,payload,revision,updated_at) VALUES(?,?,1,datetime(\'now\')) ON CONFLICT(user_sub) DO NOTHING').bind(sub,data).run();
        if(result.meta.changes===1)return json({revision:1},200,headers);
      }else{
        const result=await env.DB.prepare('UPDATE resume_state SET payload=?,revision=revision+1,updated_at=datetime(\'now\') WHERE user_sub=? AND revision=?').bind(data,sub,revision).run();
        if(result.meta.changes===1)return json({revision:revision+1},200,headers);
      }
      return json({error:'revision_conflict',message:'Remote state has changed; reload before saving.'},409,headers);
    }
    if(request.method==='DELETE'){
      await env.DB.prepare('DELETE FROM resume_state WHERE user_sub=?').bind(sub).run();
      return json({deleted:true},200,headers);
    }
    return json({error:'method_not_allowed'},405,{...headers,allow:'GET, PUT, DELETE, OPTIONS'});
  }
};
