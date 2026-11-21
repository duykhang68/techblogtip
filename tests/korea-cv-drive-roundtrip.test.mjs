import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/korea-cv/src/index.mjs';

const UUID='e4f04d77-89c3-426f-9c05-a9415a52a28a';
const ORIGIN='https://duykhang68.github.io';
const env={GOOGLE_OAUTH_CLIENT_ID:'local-test-id',ALLOWED_ORIGIN:ORIGIN};
const records=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const originalFetch=globalThis.fetch;
function fakeGoogleFetch(url,init={}){
  const uri=new URL(url);
  if(uri.hostname==='oauth2.googleapis.com'){
    if(uri.searchParams.get('access_token')!=='valid-token')return Promise.resolve(json({error:'invalid_token'},401));
    return Promise.resolve(json({issued_to:'local-test-id',scope:'https://www.googleapis.com/auth/drive.appdata'}));
  }
  if(uri.hostname==='www.googleapis.com'){
    const method=init.method||'GET';
    if(!String(init.headers?.Authorization||'').includes('valid-token'))return Promise.resolve(json({error:'unauthorized'},401));
    if(uri.pathname==='/drive/v3/files' && method==='GET'){
      const match=[...records.entries()].filter(([name])=>{
        const q=uri.searchParams.get('q')||'';
        return q.includes('name contains') ? name.startsWith('korea-cv-') : q.includes(name);
      }).map(([name,record])=>({name,id:record.googleId,modifiedTime:'2026-11-21T00:00:00Z',appProperties:record.meta?.appProperties||{}}));
      return Promise.resolve(json({files:match}));
    }
    if(uri.pathname==='/upload/drive/v3/files' && method==='POST'){
      const raw=String(init.body);
      const parts=raw.split('\r\n\r\n');
      const metadata=JSON.parse(parts[1].split('\r\n--')[0]);
      const cv=JSON.parse(parts[2].split('\r\n--')[0]);
      records.set(metadata.name,{googleId:'google-'+cv.id,data:cv,meta:metadata});
      return Promise.resolve(json({id:'google-'+cv.id,name:metadata.name}));
    }
    const id=decodeURIComponent(uri.pathname.split('/').at(-1));
    const record=[...records.entries()].find(([,value])=>value.googleId===id);
    if(uri.pathname.startsWith('/upload/drive/v3/files/')&&method==='PATCH'){
      if(!record)return Promise.resolve(json({error:'missing'},404));
      const parts=String(init.body).split('\r\n\r\n');
      record[1].meta=JSON.parse(parts[1].split('\r\n--')[0]);
      record[1].data=JSON.parse(parts[2].split('\r\n--')[0]);
      return Promise.resolve(json({id,modifiedTime:'2026-11-21T00:00:00Z'}));
    }
    if(uri.pathname.startsWith('/drive/v3/files/')&&method==='GET'&&uri.searchParams.get('alt')==='media'){
      return Promise.resolve(record?json(record[1].data):json({error:'missing'},404));
    }
    if(uri.pathname.startsWith('/drive/v3/files/')&&method==='DELETE'){
      if(record){records.delete(record[0]);return Promise.resolve(new Response(null,{status:204}));}
      return Promise.resolve(json({error:'missing'},404));
    }
  }
  throw new Error('unexpected external URL: '+String(url).split('?')[0]);
}
const cv=(revision,company='ABC')=>({
 schemaVersion:1,id:UUID,revision,targetCompany:company,targetRole:'기술자',label:'',locale:'ko',createdAt:'',updatedAt:'',
 content:{personal:{koreanName:'김철수'},essays:{growth:'성장과정'},education:[],employment:[],certifications:[],languages:[],projects:[],skills:[],awards:[],training:[],patents:[],referees:[],research:[],optionalSensitive:{},declarationOptional:null}
});
const request=async(path,method='GET',data,token='valid-token')=>{
 const res=await worker.fetch(new Request('https://korea-cv-dev.example'+path,{method,
  headers:{Origin:ORIGIN,Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})
 }),env);
 return {status:res.status,payload:await res.json(),headers:res.headers};
};
test('private simulated Google Drive full create/list/read/edit/revision-conflict/delete roundtrip',async()=>{
 globalThis.fetch=fakeGoogleFetch;records.clear();
 try{
  let r=await request('/api/korea-cv/'+UUID,'PUT',cv(0));assert.equal(r.status,200);assert.equal(r.payload.saved,true);
  r=await request('/api/korea-cv');assert.equal(r.status,200);assert.equal(r.payload.items.length,1);assert.equal(r.payload.items[0].targetCompany,'ABC');
  r=await request('/api/korea-cv/'+UUID);assert.equal(r.payload.cv.targetCompany,'ABC');
  r=await request('/api/korea-cv/'+UUID,'PUT',cv(0,'XYZ'));assert.equal(r.status,409);
  r=await request('/api/korea-cv/'+UUID,'PUT',cv(1,'XYZ'));assert.equal(r.status,200);
  r=await request('/api/korea-cv/'+UUID);assert.equal(r.payload.cv.targetCompany,'XYZ');
  r=await request('/api/korea-cv');assert.equal(r.payload.items[0].targetCompany,'XYZ');
  assert.equal(r.headers.get('cache-control'),'private, no-store');
  r=await request('/api/korea-cv/'+UUID,'DELETE');assert.equal(r.status,200);assert.equal(r.payload.deleted,true);
  r=await request('/api/korea-cv/'+UUID);assert.equal(r.status,404);
 }finally{globalThis.fetch=originalFetch;records.clear();}
});
test('rejects invalid bearer token and malformed CV without Drive writes',async()=>{
 globalThis.fetch=fakeGoogleFetch;records.clear();
 try{
  let r=await request('/api/korea-cv','GET',undefined,'invalid-token');assert.equal(r.status,401);
  r=await request('/api/korea-cv/'+UUID,'PUT',{schemaVersion:1,id:UUID,revision:0,content:{}});assert.equal(r.status,422);
  assert.equal(records.size,0);
 }finally{globalThis.fetch=originalFetch;records.clear();}
});
