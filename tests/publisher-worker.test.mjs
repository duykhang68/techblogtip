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
    sourceLeases:new Map(), lockEvents:[],
  };
  env.SOURCE_LOCKS={
    getByName(key){
      return {
        async acquire(nonce,ttl){
          state.lockEvents.push({operation:'acquire',key});
          const old=state.sourceLeases.get(key);
          if(old&&old.expires>Date.now())return false;
          state.sourceLeases.set(key,{nonce,expires:Date.now()+ttl});
          return true;
        },
        async release(nonce){
          state.lockEvents.push({operation:'release',key});
          const existing=state.sourceLeases.get(key);
          if(existing?.nonce!==nonce)return false;
          state.sourceLeases.delete(key);
          return true;
        },
      };
    },
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
      if(method==='POST'&&url.pathname.endsWith('/values:batchUpdate')){
        const body=JSON.parse(options.body);
        assert.equal(body.valueInputOption,'RAW');
        assert.equal(body.data.length,2);
        assert.equal(body.data[0].range,'VN!B2:H2');
        assert.equal(body.data[1].range,'VN!J2');
        assert.equal(body.data[0].values[0].length,7);
        body.data[0].values[0].forEach((value,i)=>{state.values[1][i+1]=value;});
        state.values[1][9]=body.data[1].values[0][0];
        return Response.json({totalUpdatedCells:8});
      }
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
      if(/^\/pulls\/[0-9]+$/.test(suffix)&&method==='GET')
        return state.pr&&suffix==='/pulls/'+state.pr.number?
          Response.json(state.pr):Response.json({message:'Not found'},{status:404});
      if(/^\/commits\/[a-f0-9]{40}\/check-runs$/.test(suffix)&&method==='GET')
        return Response.json({total_count:2,check_runs:[
          {name:'Quality',status:'completed',conclusion:'success'},
          {name:'Security Audit',status:'in_progress',conclusion:null},
        ]});
      if(suffix==='/pulls'&&method==='POST'){
        const body=JSON.parse(options.body);
        assert.equal(body.draft,true,'Publisher may only create Draft PRs');
        assert.equal(body.base,'main');
        state.pr={
          number:101,html_url:'https://github.com/duykhang68/techblogtip/pull/101',
          body:body.body,draft:true,state:'open',merged_at:null,base:{ref:'main'},
          head:{ref:body.head,sha:'c'.repeat(40),repo:{full_name:'duykhang68/techblogtip'}}
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
  const dot=cookie.lastIndexOf('.');
  const next=cookie[dot+1]==='a'?'b':'a';
  const tampered=cookie.slice(0,dot+1)+next+cookie.slice(dot+2);
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

test('read-only preflight reports live Sheet and GitHub connectivity, with no writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const ok=await f.call('/api/preflight',token);
  assert.equal(ok.status,200);
  assert.equal(ok.data.sheet.ok,true);
  assert.equal(ok.data.sheet.rows,1);
  assert.equal(ok.data.github.ok,true);
  assert.match(ok.data.github.mainSha,/^[a-f0-9]{40}$/);
  assert.equal(ok.data.draftPrWritePermission,'not_tested');
  assert.equal(f.state.calls.filter(c=>c.method!=='GET'&&c.url.includes('api.github.com')).length,0);
  assert.equal(f.state.calls.filter(c=>c.method==='PUT'&&c.url.includes('sheets.googleapis.com')).length,0);
  const unauth=await f.call('/api/preflight','');
  assert.equal(unauth.status,401);
});
test('preflight safely returns separate errors without disclosing credentials',async()=>{
  const f=await fixture(),token=await f.sign();
  const failingFetcher=(input,opts)=>String(input).includes('api.github.com')?
    Response.json({message:'Access denied'},{status:403}):f.fetcher(input,opts);
  const res=await handleRequest(f.request('/api/preflight',token),f.env,{fetcher:failingFetcher});
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.sheet.ok,true);
  assert.equal(payload.github.ok,false);
  assert.equal(payload.github.code,'github_api');
  const serialized=JSON.stringify(payload);
  assert.ok(!serialized.includes(f.env.GITHUB_PUBLISHER_TOKEN));
  assert.ok(!serialized.includes('PRIVATE KEY'));
});
test('admin UI offers authenticated preflight without pretending to test GitHub writes',async()=>{
  const f=await fixture();
  const html=await (await handleRequest(f.request('/admin',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(html,/id="preflight"/);
  const js=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(js,/api\/preflight/);
  assert.match(js,/Quyền tạo Draft PR chưa được kiểm tra/);
});

test('Publisher admin disables overlapping row actions and hides redundant Draft PR creation',async()=>{
  const f=await fixture();
  const content=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(content,/pendingRows\.has\(row\.rowNumber\)/);
  assert.match(content,/pendingRows\.add\(row\.rowNumber\)/);
  assert.match(content,/pendingRows\.delete\(row\.rowNumber\)/);
  assert.match(content,/button\.disabled=busy/);
  assert.match(content,/aria-busy/);
  assert.match(content,/row\.status\.toUpperCase\(\)==='READY'&&row\.sourceId&&!row\.draftPr/);
  assert.match(content,/window\.google\?\.accounts\?\.id\?\.disableAutoSelect/);
});

test('live read-only canary checks Sheets, GitHub and deployed Worker without source writes',async()=>{
  const {verifyPublisherLiveReadOnly}=await import('../scripts/publisher/live-readonly-canary.mjs');
  const f=await fixture(),events=[];
  const deployed='a'.repeat(40),main='b'.repeat(40);
  const fetcher=(input,options={})=>{
    const url=new URL(String(input)),method=options.method||'GET';
    events.push({hostname:url.hostname,method});
    if(url.hostname==='techblogtip-publisher-dev.tamsudev-com.workers.dev'){
      if(url.pathname==='/health')return Response.json({app:'techblogtip-publisher',releaseSha:deployed});
      if(['/api/rows','/api/preflight'].includes(url.pathname))
        return Response.json({error:'not_authenticated'},{status:401});
      if(url.pathname==='/admin')return new Response('<meta name="robots" content="noindex,nofollow">');
    }
    if(url.hostname==='api.github.com'&&url.pathname.startsWith('/repos/duykhang68/techblogtip/compare/'))
      return Response.json({status:'ahead'});
    return f.fetcher(input,options);
  };
  const report=await verifyPublisherLiveReadOnly({
    TBT_SHEETS_SPREADSHEET_ID:f.env.SHEETS_SPREADSHEET_ID,
    TBT_SHEETS_GID:f.env.SHEETS_GID,
    TBT_GOOGLE_SERVICE_ACCOUNT_JSON:f.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    TBT_GITHUB_PUBLISHER_TOKEN:f.env.GITHUB_PUBLISHER_TOKEN,
    GITHUB_SHA:main,
  },{fetcher});
  assert.equal(report.sheet.rows,1);
  assert.equal(report.github.ok,true);
  assert.equal(report.publisherDev.deployedSha,deployed);
  assert.equal(report.publisherDev.exactMainSha,false);
  assert.equal(report.anonymousDenied,true);
  assert.equal(report.draftPrWritePermission,'not_tested');
  assert.equal(events.some(e=>e.hostname==='oauth2.googleapis.com'&&e.method==='POST'),true);
  assert.equal(events.filter(e=>e.hostname==='sheets.googleapis.com'&&e.method!=='GET').length,0);
  assert.equal(events.filter(e=>e.hostname==='api.github.com'&&e.method!=='GET').length,0);
});
test('live canary requires secrets before contacting external services',async()=>{
  const {verifyPublisherLiveReadOnly}=await import('../scripts/publisher/live-readonly-canary.mjs');
  await assert.rejects(
    verifyPublisherLiveReadOnly({GITHUB_SHA:'a'.repeat(40)},{fetcher:()=>{throw Error('Should never fetch');}}),
    /Missing credential: TBT_SHEETS_SPREADSHEET_ID/
  );
});

test('P5c tracker validates source-linked PR and returns checks for exact head SHA',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][8]='READY';
  const revision=(await f.call('/api/revision?sourceId='+id,token)).data.sourceRevision;
  assert.equal((await f.call('/api/submit',token,'POST',{sourceId:id,sourceRevision:revision})).status,201);
  const result=await f.call('/api/pr-status?sourceId='+id,token);
  assert.equal(result.status,200);
  assert.equal(result.data.stage,'draft');
  assert.equal(result.data.ci.availability,'available');
  assert.equal(result.data.ci.checkedSha,'c'.repeat(40));
  assert.deepEqual(result.data.ci.checks.map(c=>c.conclusion),['success',null]);
  assert.equal(result.data.productionVerified,false);
});
test('P5c tracker rejects foreign Sheet PR URL before GitHub PR fetch',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][11]='https://attacker.example/pull/101';
  const result=await f.call('/api/pr-status?sourceId='+id,token);
  assert.equal(result.status,409);
  assert.equal(result.data.error,'pr_not_registered');
  assert.equal(f.state.calls.filter(c=>c.url.endsWith('/pulls/101')).length,0);
});
test('P5c tracker rejects PR whose body and branch do not match source',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][11]='https://github.com/duykhang68/techblogtip/pull/101';
  f.state.values[1][10]='a'.repeat(64);
  f.state.pr={number:101,html_url:f.state.values[1][11],state:'open',draft:true,
    body:'source-id: TBT-wrong-source',base:{ref:'main'},
    head:{ref:'sheets/tbt-unrelated',sha:'c'.repeat(40),repo:{full_name:'duykhang68/techblogtip'}}};
  const result=await f.call('/api/pr-status?sourceId='+id,token);
  assert.equal(result.status,409);
  assert.equal(result.data.error,'pr_source_mismatch');
});
test('P5c tracker reports merged PR without claiming production or making source writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][8]='READY';
  const revision=(await f.call('/api/revision?sourceId='+id,token)).data.sourceRevision;
  await f.call('/api/submit',token,'POST',{sourceId:id,sourceRevision:revision});
  f.state.pr.draft=false;f.state.pr.state='closed';f.state.pr.merged_at='2026-11-21T01:00:00Z';
  const before=f.state.calls.length;
  const result=await f.call('/api/pr-status?sourceId='+id,token);
  assert.equal(result.status,200);
  assert.equal(result.data.stage,'merged');
  assert.equal(result.data.productionVerified,false);
  assert.equal(result.data.ci.availability,'available');
  assert.equal(result.data.ci.checkedSha,f.state.pr.head.sha);
  const calls=f.state.calls.slice(before);
  assert.equal(calls.filter(c=>c.url.includes('api.github.com')&&c.method!=='GET').length,0);
  assert.equal(calls.filter(c=>c.url.includes('sheets.googleapis.com')&&c.method==='PUT').length,0);
});
test('P5c UI checks PR on demand via Worker and never exposes GitHub API',async()=>{
  const f=await fixture();
  const html=await (await handleRequest(f.request('/admin',''),f.env,{fetcher:f.fetcher})).text();
  const js=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(html,/id="pr-tracker"/);
  assert.match(js,/Cập nhật tiến độ/);
  assert.match(js,/api\/pr-status/);
  assert.ok(!js.includes('api.github.com'));
});


test('P5c visual editor opens only authorized editable drafts with snapshot',async()=>{
  const f=await fixture(),token=await f.sign();
  const anon=await f.call('/api/draft?sourceId=TBT-fake-1234567890','');
  assert.equal(anon.status,401);
  const assigned=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  const draft=await f.call('/api/draft?sourceId='+assigned.data.sourceId,token);
  assert.equal(draft.status,200);
  assert.equal(draft.data.sourceId,assigned.data.sourceId);
  assert.match(draft.data.snapshot,/^[a-f0-9]{64}$/);
  assert.equal(draft.data.status,'DRAFT');
  assert.equal(draft.data.fields.title,'Tìm hiểu GitHub Actions cho người mới');
  assert.equal(draft.data.fields.body.includes('## Giới thiệu'),true);
  assert.equal(draft.data.fields.slug,'');
  assert.equal(Object.keys(draft.data.fields).length,8);
});

test('P5c visual editor saves exactly B:H and J, preserving A, I and K:O',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const opened=(await f.call('/api/draft?sourceId='+id,token)).data;
  const unchanged=JSON.stringify({id:f.state.values[1][0],status:f.state.values[1][8],sys:f.state.values[1].slice(10)});
  const changed={...opened.fields,title:'Hướng dẫn GitHub Actions dành cho người mới',
    body:'## Giới thiệu\n'+('Hướng dẫn tích hợp GitHub Actions có kiểm chứng cho bạn đọc. ').repeat(3).trimEnd(),
    summary:'Giới thiệu quy trình GitHub Actions, CI/CD và cách kiểm chứng thay đổi một cách an toàn.',
    slug:'huong-dan-github-actions'};
  const result=await f.call('/api/draft',token,'PUT',{sourceId:id,expectedSnapshot:opened.snapshot,fields:changed});
  assert.equal(result.status,200);
  assert.equal(result.data.saved,true);
  assert.equal(f.state.values[1][1],changed.title);
  assert.equal(f.state.values[1][2],changed.body);
  assert.equal(f.state.values[1][6],changed.summary);
  assert.equal(f.state.values[1][9],changed.slug);
  assert.equal(JSON.stringify({id:f.state.values[1][0],status:f.state.values[1][8],sys:f.state.values[1].slice(10)}),unchanged);
  const calls=f.state.calls.filter(c=>c.method==='POST'&&c.url.includes('sheets.googleapis.com'));
  assert.equal(calls.length,1);
  assert.equal(f.state.calls.filter(c=>c.url.includes('api.github.com')).length,0);
  const again=await f.call('/api/draft',token,'PUT',{
    sourceId:id,expectedSnapshot:result.data.snapshot,fields:changed
  });
  assert.equal(again.status,200);
  assert.equal(again.data.saved,false);
  assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.url.includes('sheets.googleapis.com')).length,1);
});

test('P5c visual editor rejects stale snapshot and cross-origin writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const opened=(await f.call('/api/draft?sourceId='+id,token)).data;
  f.state.values[1][1]='Changed directly by another editor';
  const stale=await f.call('/api/draft',token,'PUT',{
    sourceId:id,expectedSnapshot:opened.snapshot,fields:{...opened.fields,title:'Different title'}
  });
  assert.equal(stale.status,409);
  assert.equal(stale.data.error,'draft_conflict');
  const forbidden=await f.call('/api/draft',token,'PUT',{
    sourceId:id,expectedSnapshot:opened.snapshot,fields:opened.fields
  },{Origin:'https://hostile.example'});
  assert.equal(forbidden.status,403);
  assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.url.includes('sheets.googleapis.com')).length,0);
});

test('P5c visual editor locks READY, submitted and published rows before writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const snap=(await f.call('/api/draft?sourceId='+id,token)).data;
  f.state.values[1][8]='READY';
  assert.equal((await f.call('/api/draft?sourceId='+id,token)).status,409);
  assert.equal((await f.call('/api/draft',token,'PUT',{sourceId:id,expectedSnapshot:snap.snapshot,fields:snap.fields})).status,409);
  f.state.values[1][8]='DRAFT';
  f.state.values[1][11]='https://github.com/duykhang68/techblogtip/pull/100';
  assert.equal((await f.call('/api/draft?sourceId='+id,token)).status,409);
  f.state.values[1][11]='';
  f.state.values[1][12]='https://example.test/article';
  assert.equal((await f.call('/api/draft?sourceId='+id,token)).status,409);
  assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.url.includes('sheets.googleapis.com')).length,0);
});

test('P5c visual editor rejects unsafe HTML, invalid body, and system-field injection',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const opened=(await f.call('/api/draft?sourceId='+id,token)).data;
  const base={sourceId:id,expectedSnapshot:opened.snapshot};
  const wrong=await f.call('/api/draft',token,'PUT',{
    ...base,fields:{...opened.fields,sourceHash:'forge'}
  });
  assert.equal(wrong.status,422);
  const html=await f.call('/api/draft',token,'PUT',{
    ...base,fields:{...opened.fields,body:'<img src=x onerror=alert(1)>'}
  });
  assert.equal(html.status,422);
  const media=await f.call('/api/draft',token,'PUT',{
    ...base,fields:{...opened.fields,body:'![cover](https://drive.google.com/image.webp)'}
  });
  assert.equal(media.status,422);
  const invalid=await f.call('/api/draft',token,'PUT',{
    ...base,fields:{...opened.fields,slug:'Unsafe Slug'}
  });
  assert.equal(invalid.status,422);
  assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.url.includes('sheets.googleapis.com')).length,0);
});

test('P5c editor UI has visual contenteditable, safe paste and no client GitHub API',async()=>{
  const f=await fixture();
  const html=await (await handleRequest(f.request('/admin',''),f.env,{fetcher:f.fetcher})).text();
  const js=await (await handleRequest(f.request('/editor.js',''),f.env,{fetcher:f.fetcher})).text();
  const mainJs=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(html,/id="editor-panel"/);
  assert.match(html,/id="editor-body"[^>]*contenteditable="true"/);
  assert.match(html,/src="\/editor.js"/);
  assert.match(mainJs,/Sửa trực quan/);
  assert.match(js,/api\/draft/);
  assert.match(js,/clipboardData.*text\/plain/);
  assert.ok(!js.includes('innerHTML'));
  assert.ok(!js.includes('api.github.com'));
  assert.ok(!js.includes('localStorage'));
  assert.doesNotThrow(()=>new Function(js));
});


test('P5c visual editor preserves original Sheet body for metadata-only edits',async()=>{
  const f=await fixture();
  const js=await (await handleRequest(f.request('/editor.js',''),f.env,{fetcher:f.fetcher})).text();
  // Serializing the visual DOM is not lossless for paragraph spacing.
  // Only modified visual contents may be sent as newly serialized Markdown.
  assert.match(js,/active\.sourceBody/);
  assert.match(js,/active\.visualInitial/);
  assert.match(js,/visual===active\.visualInitial\?active\.sourceBody:visual/);
  assert.match(js,/active\.sourceBody=result\.fields\.body/);
  assert.match(js,/active\.visualInitial=serialize\(\)/);
  assert.match(js,/Bản nháp ở nguồn đã thay đổi/);
  assert.doesNotThrow(()=>new Function(js));
});


test('source lock blocks concurrent draft writes before touching Google Sheets',async()=>{
  const f=await fixture(),token=await f.sign();
  const sourceId=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const draft=(await f.call('/api/draft?sourceId='+sourceId,token)).data;
  const key=f.env.SHEETS_SPREADSHEET_ID+':'+f.env.SHEETS_GID+':source:'+sourceId;
  const stub=f.env.SOURCE_LOCKS.getByName(key);
  const holder='00000000-0000-0000-0000-000000000001';
  assert.equal(await stub.acquire(holder,120000),true);
  const before=f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length;
  const refused=await f.call('/api/draft',token,'PUT',{
    sourceId,expectedSnapshot:draft.snapshot,fields:{...draft.fields,title:'Changed on second request'}
  });
  assert.equal(refused.status,409);
  assert.equal(refused.data.error,'source_busy');
  assert.equal(f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length,before,'Lock denial must happen before reading or writing source');
  assert.equal(await stub.release(holder),true);
  const accepted=await f.call('/api/draft',token,'PUT',{
    sourceId,expectedSnapshot:draft.snapshot,fields:{...draft.fields,title:'Changed after lock released'}
  });
  assert.equal(accepted.status,200);
  assert.equal(accepted.data.saved,true);
  assert.equal(f.state.sourceLeases.size,0);
});
test('source lock rejects overlapping Draft PR submissions before any GitHub writes',async()=>{
  const f=await fixture(),token=await f.sign();
  const sourceId=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][8]='READY';
  const revision=(await f.call('/api/revision?sourceId='+sourceId,token)).data.sourceRevision;
  const key=f.env.SHEETS_SPREADSHEET_ID+':'+f.env.SHEETS_GID+':source:'+sourceId;
  const stub=f.env.SOURCE_LOCKS.getByName(key);
  const holder='00000000-0000-0000-0000-000000000002';
  assert.equal(await stub.acquire(holder,120000),true);
  const before=f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length;
  const refused=await f.call('/api/submit',token,'POST',{sourceId,sourceRevision:revision});
  assert.equal(refused.status,409);
  assert.equal(refused.data.error,'source_busy');
  assert.equal(f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length,before);
  assert.equal(f.state.pr,null);
  await stub.release(holder);
  assert.equal((await f.call('/api/submit',token,'POST',{sourceId,sourceRevision:revision})).status,201);
  assert.equal(f.state.sourceLeases.size,0);
});
test('source lock is fail closed without Durable Object binding and releases on error',async()=>{
  const f=await fixture(),token=await f.sign();
  const sourceId=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  const draft=(await f.call('/api/draft?sourceId='+sourceId,token)).data;
  f.env.SOURCE_LOCKS=undefined;
  const before=f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length;
  const denied=await f.call('/api/draft',token,'PUT',{
    sourceId,expectedSnapshot:draft.snapshot,fields:{...draft.fields,title:'Unauthorized write without DO'}
  });
  assert.equal(denied.status,503);
  assert.equal(denied.data.error,'source_lock_unconfigured');
  assert.equal(f.state.calls.filter(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('api.github.com')).length,before);
  f.env.SOURCE_LOCKS={getByName(key){return {
    async acquire(){return true;},
    async release(){throw Error('Simulated release network error');}
  };}};
  const afterReleaseError=await f.call('/api/draft',token,'PUT',{
    sourceId,expectedSnapshot:draft.snapshot,fields:{...draft.fields,body:draft.fields.body.trim()}
  });
  assert.equal(afterReleaseError.status,200);
  assert.equal(afterReleaseError.data.saved,true);
  assert.equal(f.state.values[1][2],draft.fields.body.trim());
});
test('row ID allocation lock blocks repeated concurrent writes for the same pinned row',async()=>{
  const f=await fixture(),token=await f.sign();
  const key=f.env.SHEETS_SPREADSHEET_ID+':'+f.env.SHEETS_GID+':row:2';
  const stub=f.env.SOURCE_LOCKS.getByName(key);
  const holder='00000000-0000-0000-0000-000000000003';
  await stub.acquire(holder,120000);
  const no=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  assert.equal(no.status,409);
  assert.equal(f.state.values[1][0],'');
  await stub.release(holder);
  const yes=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  assert.equal(yes.status,200);
  assert.equal(yes.data.created,true);
});


test('ready validator evaluates DRAFT without changing Sheet status or creating a PR',async()=>{
  const f=await fixture(),token=await f.sign();
  const assigned=await f.call('/api/allocate-id',token,'POST',{rowNumber:2});
  const sourceId=assigned.data.sourceId;
  const before=f.state.calls.length;
  const result=await f.call('/api/validate?sourceId='+sourceId,token);
  assert.equal(result.status,200);
  assert.equal(result.data.sourceId,sourceId);
  assert.equal(result.data.status,'DRAFT');
  assert.equal(result.data.contentValid,true);
  assert.equal(result.data.canSubmit,false);
  assert.equal(result.data.approvalRequired,true);
  assert.match(result.data.sourceRevision,/^[a-f0-9]{64}$/);
  assert.equal(f.state.values[1][8],'DRAFT');
  const calls=f.state.calls.slice(before);
  assert.equal(calls.filter(c=>c.url.includes('api.github.com')).length,0);
  assert.equal(calls.filter(c=>c.url.includes('sheets.googleapis.com')&&c.method!=='GET').length,0);
});
test('ready validator reports invalid article fields and does not create GitHub PR',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][9]='INVALID SLUG';
  const invalid=await f.call('/api/validate?sourceId='+id,token);
  assert.equal(invalid.status,200);
  assert.equal(invalid.data.contentValid,false);
  assert.equal(invalid.data.canSubmit,false);
  assert.equal(invalid.data.issues[0].code,'content_invalid');
  assert.equal(f.state.pr,null);
  f.state.values[1][9]='';
  f.state.values[1][8]='READY';
  const okay=await f.call('/api/validate?sourceId='+id,token);
  assert.equal(okay.data.contentValid,true);
  assert.equal(okay.data.canSubmit,true);
});
test('ready validator blocks a second submission when system fields already occupied',async()=>{
  const f=await fixture(),token=await f.sign();
  const id=(await f.call('/api/allocate-id',token,'POST',{rowNumber:2})).data.sourceId;
  f.state.values[1][8]='READY';
  f.state.values[1][11]='https://github.com/duykhang68/techblogtip/pull/123';
  const result=await f.call('/api/validate?sourceId='+id,token);
  assert.equal(result.status,200);
  assert.equal(result.data.contentValid,true);
  assert.equal(result.data.canSubmit,false);
  assert.equal(result.data.submittedOrPublished,true);
});
test('ready validator requires authorized editor and does not expose public GitHub API',async()=>{
  const f=await fixture();
  assert.equal((await f.call('/api/validate?sourceId=TBT-fake-1234567890','')).status,401);
  const html=await (await handleRequest(f.request('/admin',''),f.env,{fetcher:f.fetcher})).text();
  const js=await (await handleRequest(f.request('/admin.js',''),f.env,{fetcher:f.fetcher})).text();
  assert.match(html,/id="validation-panel"/);
  assert.match(js,/Kiểm tra bài/);
  assert.match(js,/api\/validate/);
  assert.ok(!js.includes('api.github.com'));
});
