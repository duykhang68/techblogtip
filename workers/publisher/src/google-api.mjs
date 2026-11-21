import { fail } from './auth.mjs';

const TOKEN_ENDPOINT='https://oauth2.googleapis.com/token';
const API='https://sheets.googleapis.com/v4/spreadsheets/';
const SCOPE='https://www.googleapis.com/auth/spreadsheets';
const HEADERS=[
 'source_id','title','body','author','category','tags','summary','series',
 'status','slug','source_hash','draft_pr','published_url','release_sha','published_at'
];
function b64url(binary){
  let chars='';
  for(let i=0;i<binary.length;i+=8192)chars+=String.fromCharCode(...binary.subarray(i,i+8192));
  return btoa(chars).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function privateKeyBytes(pem){
  return Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
}
async function createAssertion(config,time=Math.floor(Date.now()/1000),scope=SCOPE){
  const encode=obj=>b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const header=encode({alg:'RS256',typ:'JWT'});
  const claims=encode({iss:config.client_email,scope,aud:TOKEN_ENDPOINT,iat:time,exp:time+3500});
  const payload=header+'.'+claims;
  const key=await crypto.subtle.importKey('pkcs8',privateKeyBytes(config.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(payload));
  return payload+'.'+b64url(new Uint8Array(signature));
}
export function sheetConfig(env){
  const spreadsheetId=String(env.SHEETS_SPREADSHEET_ID||'').trim();
  const gid=String(env.SHEETS_GID??'').trim();
  if(!/^[a-zA-Z0-9_-]{15,150}$/.test(spreadsheetId)||!/^\d+$/.test(gid))
    fail(503,'sheet_not_configured','TechBlogTip Sheet ID/GID is not configured');
  return {spreadsheetId,gid};
}
export async function getSheetsToken(env,fetcher=fetch,scope=SCOPE){
  if(![SCOPE,'https://www.googleapis.com/auth/drive.readonly'].includes(scope))fail(400,'google_scope_invalid','Unapproved Google OAuth scope');
  let account;
  try{account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'');}catch{fail(503,'google_not_configured','Google service account secret missing');}
  if(account?.type!=='service_account'||!account.private_key?.includes('PRIVATE KEY')||
     !account.client_email?.endsWith('.gserviceaccount.com'))
     fail(503,'google_not_configured','Google service account fields incomplete');
  let assertion;
  try{assertion=await createAssertion(account,undefined,scope);}catch{fail(503,'google_not_configured','Cannot sign Google service-account assertion');}
  const response=await fetcher(TOKEN_ENDPOINT,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)fail(502,'google_auth','Google service-account OAuth request failed');
  const result=await response.json();
  if(!result.access_token||result.token_type?.toLowerCase()!=='bearer')fail(502,'google_auth','No bearer token returned');
  return result.access_token;
}
async function sheetsGet(env,token,uri,fetcher){
  const response=await fetcher(API+encodeURIComponent(sheetConfig(env).spreadsheetId)+uri,{
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)fail(502,'sheet_read_failed','Could not read authorized TechBlogTip spreadsheet');
  if(Number(response.headers.get('content-length')||0)>2_000_000)fail(413,'sheet_too_large','Spreadsheet response exceeds limit');
  const text=await response.text();
  if(text.length>2_000_000)fail(413,'sheet_too_large','Spreadsheet response exceeds limit');
  try{return JSON.parse(text);}catch{fail(502,'sheet_malformed','Google Sheets returned invalid data');}
}
export async function readSheet(env,fetcher=fetch){
  const {gid}=sheetConfig(env);
  const token=await getSheetsToken(env,fetcher);
  const meta=await sheetsGet(env,token,'?fields=sheets(properties(sheetId,title))',fetcher);
  if(!meta.sheets?.some(s=>String(s.properties?.sheetId)===gid&&s.properties?.title==='VN'))
    fail(409,'sheet_tab_changed','Configured VN sheet GID does not match');
  const result=await sheetsGet(env,token,'/values/'+encodeURIComponent('VN!A1:O200'),fetcher);
  if(!Array.isArray(result.values)||!HEADERS.every((h,i)=>result.values[0]?.[i]===h))
    fail(409,'schema_mismatch','VN sheet headers do not match publisher contract');
  const records=result.values.slice(1).map((v,i)=>({
    rowNumber:i+2,
    cells:Array.from({length:15},(_,j)=>String(v?.[j]??'')),
  })).filter(r=>r.cells.some(x=>x.trim()));
  const ids=records.map(r=>r.cells[0].trim()).filter(Boolean);
  if(new Set(ids).size!==ids.length)fail(409,'duplicate_source_id','Duplicated source IDs in Google Sheet');
  return {records,token};
}
export async function putSystemCells(env,token,rowNumber,columns,values,fetcher=fetch){
  if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)fail(400,'row_invalid','Row number out of range');
  if(!['A','K:L','M:O'].includes(columns))fail(400,'column_denied','Only system-owned columns may be written');
  if((columns==='A'&&values.length!==1)||(columns==='K:L'&&values.length!==2)||(columns==='M:O'&&values.length!==3))
    fail(400,'value_invalid','Wrong number of system values');
  const {spreadsheetId}=sheetConfig(env);
  const range='VN!'+columns.replace(':',rowNumber+':')+rowNumber;
  const url=API+encodeURIComponent(spreadsheetId)+'/values/'+encodeURIComponent(range)+'?valueInputOption=RAW';
  const response=await fetcher(url,{
    method:'PUT',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({range,majorDimension:'ROWS',values:[values]}),
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)fail(502,'sheet_write_failed','Could not write system-owned cells');
}
// Erases the complete article (A:O), leaving a blank row so unrelated
// source IDs and pending row-scoped operations cannot shift underneath us.
export async function clearArticleCells(env,token,rowNumber,fetcher=fetch){
  if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)
    fail(400,'row_invalid','Row number out of range');
  const {spreadsheetId}=sheetConfig(env);
  const range='VN!A'+rowNumber+':O'+rowNumber;
  const url=API+encodeURIComponent(spreadsheetId)+'/values/'+encodeURIComponent(range)+':clear';
  const response=await fetcher(url,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)fail(502,'sheet_delete_failed','Could not erase article data in Google Sheets');
  const result=await response.json();
  if(result.clearedRange!==range)
    fail(502,'sheet_delete_unconfirmed','Google Sheets did not confirm the exact article range');
}

export function rowById(records,sourceId){
  const matches=records.filter(r=>r.cells[0].trim()===sourceId);
  if(matches.length!==1)fail(409,'source_missing','Source ID missing or duplicated after sheet reorder');
  return matches[0];
}


// Writes only editor-owned cells B:H and J. Status I and all system-owned
// columns A, K:O remain untouched in this atomic Sheets batchUpdate.
export async function putEditorialCells(env,token,rowNumber,values,fetcher=fetch){
  if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)
    fail(400,'row_invalid','Row number out of range');
  const names=['title','body','author','category','tags','summary','series','slug'];
  if(!values||names.some(name=>typeof values[name]!=='string'))
    fail(422,'draft_invalid','Invalid editorial field values');
  const {spreadsheetId}=sheetConfig(env);
  const endpoint=API+encodeURIComponent(spreadsheetId)+'/values:batchUpdate';
  const data=[
    {range:'VN!B'+rowNumber+':H'+rowNumber,majorDimension:'ROWS',
      values:[names.slice(0,7).map(name=>values[name])]},
    {range:'VN!J'+rowNumber,majorDimension:'ROWS',values:[[values.slug]]}
  ];
  const response=await fetcher(endpoint,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({valueInputOption:'RAW',data,includeValuesInResponse:false}),
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)
    fail(502,'sheet_write_failed','Could not write TechBlogTip editorial cells');
}


// Allocate a new independent editorial row without touching the published source.
export async function writeRevisionRow(env,token,rowNumber,cells,fetcher=fetch){
 if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200||!Array.isArray(cells)||cells.length!==15)
  fail(400,'row_invalid','Invalid destination row');
 const {spreadsheetId}=sheetConfig(env),range='VN!A'+rowNumber+':O'+rowNumber;
 const url=API+encodeURIComponent(spreadsheetId)+'/values/'+encodeURIComponent(range)+'?valueInputOption=RAW';
 const response=await fetcher(url,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({range,majorDimension:'ROWS',values:[cells]}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)fail(502,'sheet_write_failed','Cannot create revision DRAFT row');
}
