import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyGoogleIdToken } from '../workers/publisher/src/auth.mjs';
import { handleRequest } from '../workers/publisher/src/index.mjs';
import { prepareSheetArticle } from '../scripts/publisher/sheets.mjs';

globalThis.crypto ??= webcrypto;
const origin='https://techblogtip-publisher-dev.example.test';
const CLIENT='techblogtip-test.apps.googleusercontent.com';
const HEADERS=[
 'source_id','title','body','author','category','tags','summary','series',
 'status','slug','source_hash','draft_pr','published_url','release_sha','published_at',
];
function b64(buffer){
  return Buffer.from(buffer).toString('base64url');
}
async function fixture(){
  const pair=await crypto.subtle.generateKey(
    {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
    true,['sign','verify']
  );
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
  jwk.kid='unit-key';jwk.use='sig';jwk.alg='RS256';
  const der=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
  const pem='-----BEGIN PRIVATE KEY-----\n'+der.match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----';
  const serviceAccount=JSON.stringify({
    type:'service_account',client_email:'test@fake.gserviceaccount.com',private_key:pem
  });
  const env={
    SHEETS_SPREADSHEET_ID:'testSheetUniqueId_000000001',
    SHEETS_GID:'142694714',
    GOOGLE_SERVICE_ACCOUNT_JSON:serviceAccount,
    GOOGLE_OAUTH_CLIENT_ID:CLIENT,
    ALLOWED_EDITORS:'editor@example.test',
    GITHUB_PUBLISHER_TOKEN:'fake-secret-not-for-browser'
  };
  const now=Math.floor(Date.now()/1000);
  async function sign(claimsOverride={}){
    const claims={
      iss:'https://accounts.google.com',aud:CLIENT,iat:now,
      exp:now+1800,email:'editor@example.test',email_verified:true,sub:'editor-123',
      ...claimsOverride
    };
    const input=b64(JSON.stringify({alg:'RS256',kid:'unit-key',typ:'JWT'}))+'.'+b64(JSON.stringify(claims));
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));
    return input+'.'+b64(signature);
  }
  const state={
    values:[HEADERS,[
      '', 'Tìm hiểu GitHub Actions cho người mới',
      '## Giới thiệu\n'+('Bài thử nghiệm chi tiết giải thích quy trình GitHub Actions cho người dùng Việt Nam.\n').repeat(3),
      'TechBlogTip','Lập trình & GitHub','CI, GitHub Actions',
      'Tổng hợp kiến thức cơ bản về GitHub Actions và kiểm thử tự động cho các dự án công nghệ.',
      'Git từ cơ bản','DRAFT','','','','','',''
    ]],
    pr:null,branches:new Set(),files:new Map(),calls:[],
  };
  async function fetcher(input,options={}){
    const url=new URL(String(input)),method=options.method||'GET';
    state.calls.push({url:url.href,method,body:options.body?.toString()?.slice(0,200)||''});
    if(url.hostname==='www.googleapis.com'&&url.pathname==='/oauth2/v3/certs')
      return Response.json({keys:[jwk]});
    if(url.hostname==='oauth2.googleapis.com'&&url.pathname==='/token')
      return Response.json({access_token:'mock-access-token',token_type:'Bearer'});
    if(url.hostname==='sheets.googleapis.com'){
      const auth=options.headers?.Authorization;
      if(auth!=='Bearer mock-access-token')return Response.json({}, {status:401});
      if(url.searchParams.has('fields'))
        return Response.json({sheets:[{properties:{sheetId:142694714,title:'VN'}}]});
      if(method==='GET'&&url.pathname.includes('/values/'))
        return Response.json({values:state.values.map(row=>[...row])});
      if(method==='PUT'&&url.pathname.includes('/values/')){
        const rawRange=decodeURIComponent(url.pathname.split('/values/')[1]);
        const body=JSON.parse(options.body);
        if(rawRange.endsWith('!A2')){
          state.values[1][0]=body.values[0][0];
        } else if(rawRange.endsWith('!K2:L2')){
          state.values[1][10]=body.values[0][0];
          state.values[1][11]=body.values[0][1];
        }else return Response.json({error:'bad range '+rawRange},{status:400});
        return Response.json({updatedRange:rawRange});
      }
    }
    if(url.hostname==='api.github.com'){
      if(options.headers?.Authorization!=='Bearer '+env.GITHUB_PUBLISHER_TOKEN)
        return Response.json({message:'unauthorized'}, {status:401});
      const suffix=url.pathname.replace('/repos/duykhang68/techblogtip','');
      if(suffix==='/pulls'&&method==='GET')return Response.json(state.pr?[state.pr]:[]);
      if(suffix==='/pulls'&&method==='POST'){
        const body=JSON.parse(options.body);
        assert.equal(body.draft,true,'Publisher may only create Draft PRs');
        assert.equal(body.base,'main');
        state.pr={
          number:101,html_url:'https://github.com/duykhang68/techblogtip/pull/101',
          body:body.body,draft:true,base:{ref:'main'}
        };
        return Response.json(state.pr,{status:201});
      }
      if(suffix==='/git/ref/heads/main')return Response.json({object:{sha:'a'.repeat(40)}});
      if(suffix.startsWith('/git/ref/heads/sheets/')){
        return state.branches.has(suffix.replace('/git/ref/heads/',''))?
          Response.json({ref:suffix},{status:200}):Response.json({message:'Not Found'},{status:404});
      }
      if(suffix==='/git/refs'&&method==='POST'){
        const body=JSON.parse(options.body);state.branches.add(body.ref.replace('refs/heads/',''));
        return Response.json({ref:body.ref},{status:201});
      }
      if(suffix.startsWith('/contents/')&&method==='GET')return Response.json({message:'Not Found'},{status:404});
      if(suffix.startsWith('/contents/')&&method==='PUT'){
        const body=JSON.parse(options.body);
        state.files.set(suffix,{branch:body.branch,markdown:Buffer.from(body.content,'base64').toString()});
        return Response.json({content:{path:suffix}},{status:201});
      }
      return Response.json({error:'unhandled github '+suffix},{status:500});
    }
    return Response.json({error:'unhandled '+url.href},{status:500});
  }
  function request(path,token,method='GET',body,override={}){
    return new Request(origin+path,{
      method,
      headers:{
        ...(token?{Authorization:'Bearer '+token}:{}),
        ...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{}),
        ...override,
      },
      ...(body?{body:JSON.stringify(body)}:{}),
    });
  }
  async function call(path,token,method='GET',body,override){
    const response=await handleRequest(request(path,token,method,body,override),env,{fetcher});
    const data=await response.json();
    return {status:response.status,data};
  }
  return {env,state,sign,call,fetcher,request};
}
test('server rejects anonymous requests before it contacts Sheets',async()=>{
  const f=await fixture();
  const r=await f.call('/api/rows','');
  assert.equal(r.status,401);
  assert.equal(f.state.calls.length,0);
});
test('Google ID token validates signature, expiry, allowed audience, editor allowlist',async()=>{
  const f=await fixture(),token=await f.sign();
  assert.equal((await verifyGoogleIdToken(token,CLIENT,f.env.ALLOWED_EDITORS,f.fetcher)).email,'editor@example.test');
  const expired=await f.sign({exp:Math.floor(Date.now()/1000)-5});
  await assert.rejects(verifyGoogleIdToken(expired,CLIENT,f.env.ALLOWED_EDITORS,f.fetcher),{code:'invalid_claims'});
  const wrongAudience=await f.sign({aud:'another-app'});
  await assert.rejects(verifyGoogleIdToken(wrongAudience,CLIENT,f.env.ALLOWED_EDITORS,f.fetcher),{code:'invalid_claims'});
  const alien=await f.sign({email:'intruder@example.test'});
  await assert.rejects(verifyGoogleIdToken(alien,CLIENT,f.env.ALLOWED_EDITORS,f.fetcher),{code:'not_editor'});
  const tampered=token.slice(0,-8)+'AAAAAAAA';
  await assert.rejects(verifyGoogleIdToken(tampered,CLIENT,f.env.ALLOWED_EDITORS,f.fetcher),{code:'bad_token'});
});
test('same-origin protection blocks cross-site PR submissions',async()=>{
  const f=await fixture(),token=await f.sign();
  const r=await f.call('/api/submit',token,'POST',{sourceId:'TBT-fake-valid-1234',sourceRevision:'0'.repeat(64)},{Origin:'https://attacker.example'});
  assert.equal(r.status,403);
  assert.equal(f.state.calls.filter(c=>c.url.includes('api.github.com')).length,0);
});
test('only authenticated editor can allocate system ID in column A',async()=>{
  const f=await fixture(),token=await f.sign();
  const list=await f.call('/api/rows',token);
  assert.equal(list.status,200);
  assert.equal(list.data.rows[0].status,'DRAFT');
  assert.equal(list.data.rows[0].sourceId,'');
  const assigned=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  assert.equal(assigned.status,200);
  assert.ok(/^TBT-[a-f0-9-]{36}$/.test(assigned.data.sourceId));
  assert.equal(f.state.values[1][0],assigned.data.sourceId);
  const second=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  assert.equal(second.data.created,false);
  assert.equal(second.data.sourceId,assigned.data.sourceId);
  assert.equal(f.state.calls.filter(c=>c.method==='PUT'&&c.url.includes('sheets.googleapis.com')).length,1);
});
test('READY source can create exactly one GitHub Draft PR, with only K:L writeback',async()=>{
  const f=await fixture(),token=await f.sign();
  const assigned=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  const sourceId=assigned.data.sourceId;
  f.state.values[1][8]='READY';
  const revision=await f.call('/api/revision?sourceId='+sourceId,token);
  assert.equal(revision.status,200);
  assert.equal(revision.data.sourceRevision.length,64);
  const published=await f.call('/api/submit',token,'POST',{sourceId,sourceRevision:revision.data.sourceRevision});
  assert.equal(published.status,201);
  assert.equal(published.data.review,'draft');
  assert.equal(published.data.published,false);
  assert.equal(f.state.pr.draft,true);
  assert.equal(f.state.values[1][10],revision.data.sourceRevision);
  assert.equal(f.state.values[1][11],published.data.prUrl);
  assert.deepEqual(f.state.values[1].slice(12,15),['','',''],'Release columns must never auto-fill');
  assert.equal(f.state.files.size,1);
  const file=[...f.state.files.values()][0].markdown;
  assert.match(file,/sourceType: "google-sheets"/);
  assert.match(file,/## Giới thiệu/);
  assert.equal((await f.call('/api/submit',token,'POST',{sourceId,sourceRevision:revision.data.sourceRevision})).data.created,false);
  assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/pulls')).length,1);
});
test('stale revision refuses PR without GitHub writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][8]='READY';
  const saved=(await f.call('/api/revision?sourceId='+id,token)).data.sourceRevision;
  f.state.values[1][2]+='\nNgười biên tập vừa sửa nội dung.';
  const result=await f.call('/api/submit',token,'POST',{sourceId:id,sourceRevision:saved});
  assert.equal(result.status,409);
  assert.equal(result.data.error,'revision_conflict');
  assert.equal(f.state.calls.filter(c=>c.url.includes('api.github.com')).length,0);
});
test('DRAFT row cannot create a PR even when requested',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const r=await f.call('/api/submit',token,'POST',{sourceId:id,sourceRevision:'0'.repeat(64)});
  assert.equal(r.status,422);
  assert.equal(f.state.pr,null);
});
test('admin HTML contains no secrets, has noindex, and UI uses Worker not GitHub API',async()=>{
  const f=await fixture();
  const page=await handleRequest(f.request('/admin',''),f.env,{fetcher:f.fetcher});
  const html=await page.text();
  assert.equal(page.status,200);
  assert.ok(html.includes('noindex,nofollow'));
  assert.ok(html.includes(CLIENT));
  assert.ok(!html.includes(f.env.GITHUB_PUBLISHER_TOKEN));
  assert.ok(!html.includes('PRIVATE KEY'));
  assert.ok(page.headers.get('content-security-policy')?.includes('frame-ancestors'));
  const js=await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher});
  const source=await js.text();
  assert.ok(source.includes('/api/submit'));
  assert.ok(!source.includes('api.github.com'));
});
test('normalizer enforces only READY and stable article path',()=>{
  const f={
    sourceId:'TBT-cd487204-41ac-4029-aead-3d30124eb721',
    title:'Hướng dẫn tin học văn phòng',
    body:'Nội dung hướng dẫn chi tiết về thao tác tin học trong thực tế. '.repeat(4),
    author:'TechBlogTip',category:'Văn phòng',tags:'Google Sheets',
    summary:'Hướng dẫn làm việc với bảng tính một cách có hệ thống và dễ thực hành.',
    series:'',status:'READY',slug:''
  };
  const r=prepareSheetArticle(f,{spreadsheetId:'sheet-id-123456789012345',sheetGid:'142694714',publishedDate:'2026-11-20'});
  assert.match(r.path,/^src\/content\/articles\/[a-z0-9-]+\.md$/);
  assert.equal(r.sourceRevision.length,64);
});

test('public health exposes exact deployment SHA but not private bindings',async()=>{
  const f=await fixture();
  f.env.DEPLOY_SHA='abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const res=await handleRequest(f.request('/health',''),f.env,{fetcher:f.fetcher});
  const payload=await res.json();
  assert.equal(res.status,200);
  assert.equal(payload.releaseSha,f.env.DEPLOY_SHA);
  assert.equal(payload.status,'online');
  assert.ok(!JSON.stringify(payload).includes('fake-secret-not-for-browser'));
  assert.ok(!JSON.stringify(payload).includes('PRIVATE KEY'));
});

test('one Google login creates a 7-day HttpOnly cookie that survives page reload',async()=>{
  const f=await fixture(),idToken=await f.sign();
  const loggedIn=await handleRequest(
    f.request('/api/session','', 'POST',{credential:idToken}),
    f.env,{fetcher:f.fetcher}
  );
  assert.equal(loggedIn.status,200);
  const login=await loggedIn.json();
  assert.equal(login.editor,'editor@example.test');
  const setCookie=loggedIn.headers.get('set-cookie');
  assert.match(setCookie,/^tbt_editor_session=/);
  assert.match(setCookie,/Max-Age=604800/);
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/Secure/);
  assert.match(setCookie,/SameSite=Strict/);
  assert.ok(!setCookie.includes(idToken),'Google token must never appear in cookie');
  const persisted=setCookie.split(';')[0];
  const newPageSession=await f.call('/api/session','', 'GET',undefined,{Cookie:persisted});
  assert.equal(newPageSession.status,200);
  assert.equal(newPageSession.data.editor,'editor@example.test');
  const reloaded=await f.call('/api/rows','', 'GET',undefined,{Cookie:persisted});
  assert.equal(reloaded.status,200);
  assert.equal(reloaded.data.rows.length,1);
  const logout=await handleRequest(
    f.request('/api/session','', 'DELETE',undefined,{Cookie:persisted}),
    f.env,{fetcher:f.fetcher}
  );
  assert.equal(logout.status,200);
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.call('/api/session','')).status,401);
});
test('session tampering, token rotation, expiry and revoked editor access are rejected',async()=>{
  const f=await fixture(),googleToken=await f.sign();
  const signed=await handleRequest(f.request('/api/session','', 'POST',{credential:googleToken}),f.env,{fetcher:f.fetcher});
  const cookie=signed.headers.get('set-cookie').split(';')[0];
  const tail=cookie.slice(-1)==='a'?'b':'a';
  const tampered=cookie.slice(0,-1)+tail;
  assert.equal((await f.call('/api/rows','','GET',undefined,{Cookie:tampered})).status,401);
  const rotated={...f.env,GITHUB_PUBLISHER_TOKEN:'a-completely-rotated-valid-publisher-token-0000'};
  const rejected=await handleRequest(f.request('/api/session','','GET',undefined,{Cookie:cookie}),rotated,{fetcher:f.fetcher});
  assert.equal(rejected.status,401);
  const noAccess={...f.env,ALLOWED_EDITORS:'other@example.test'};
  const blocked=await handleRequest(f.request('/api/rows','','GET',undefined,{Cookie:cookie}),noAccess,{fetcher:f.fetcher});
  assert.equal(blocked.status,403);
  const {verifySession}=await import('../workers/publisher/src/session.mjs');
  await assert.rejects(verifySession(f.request('/api/session','','GET',undefined,{Cookie:cookie}),f.env,Math.floor(Date.now()/1000)+604801),{code:'session_expired'});
});
test('cookie session sign-in and logout require same origin, without GitHub access',async()=>{
  const f=await fixture(),token=await f.sign();
  const wrong=await f.call('/api/session','','POST',{credential:token},{Origin:'https://phishing.example.test'});
  assert.equal(wrong.status,403);
  const crossLogout=await f.call('/api/session','','DELETE',undefined,{Origin:'https://phishing.example.test'});
  assert.equal(crossLogout.status,403);
  assert.equal(f.state.calls.filter(c=>c.url.includes('api.github.com')).length,0);
});
test('admin JS uses secure same-origin cookies and does not persist Google tokens in browser storage',async()=>{
  const f=await fixture();
  const source=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(source,/credentials:'same-origin'/);
  assert.match(source,/api\/session/);
  assert.match(source,/Đã đăng nhập:/);
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!source.includes("Authorization:'Bearer '"));
});
