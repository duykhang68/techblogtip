// Read-only Google Search Console URL Inspection. Never submit URLs for indexing.
import {createSign} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const base='https://duykhang68.github.io/techblogtip/';
const summary=process.env.GITHUB_STEP_SUMMARY;
const write=(s)=>{console.log(s);if(summary)appendFileSync(summary,s+'\n')};
const secret=process.env.GSC_SERVICE_ACCOUNT_JSON;
if(!secret){write('### Google indexing monitor — SKIP\nGSC_SERVICE_ACCOUNT_JSON is not configured. No indexing status claims were made.');process.exit(0)}
let account;
try{account=JSON.parse(secret)}catch{throw Error('GSC_SERVICE_ACCOUNT_JSON is invalid JSON')}
if(!account.client_email||!account.private_key)throw Error('Service account must contain client_email/private_key');
const property=process.env.GSC_SITE_URL||base;
const b64=(v)=>Buffer.from(JSON.stringify(v)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const payload=b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500});
const header=b64({alg:'RS256',typ:'JWT'});
const input=header+'.'+payload;
const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
const assertion=input+'.'+signer.sign(account.private_key,'base64url');
const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000)});
if(!auth.ok)throw Error('Google OAuth HTTP '+auth.status);
const token=(await auth.json()).access_token;
if(!token)throw Error('Google OAuth returned no access token');
const site=await fetch(base+'sitemap.xml',{signal:AbortSignal.timeout(15000)});
if(!site.ok)throw Error('Production sitemap HTTP '+site.status);
const xml=await site.text();
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1].replaceAll('&amp;','&'));
const articles=urls.filter(u=>u.startsWith(base+'bai-viet/'));
const sample=[base,...articles.slice(0,9)];
if(!urls.length)throw Error('Empty sitemap');
const counts={PASS:0,NOT_INDEXED:0,UNKNOWN:0};
write('### Google Search Console URL Inspection\n\nProperty: '+property+'; sampled '+sample.length+' of '+urls.length+' sitemap URLs. This is a sample, not a sitewide indexing count.\n');
for(const inspectionUrl of sample){
 const res=await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({inspectionUrl,siteUrl:property}),signal:AbortSignal.timeout(15000)});
 if(!res.ok){
  write('- '+inspectionUrl+' — inspection unavailable (HTTP '+res.status+'). Verify property access/API enablement.');
  counts.UNKNOWN++;continue;
 }
 const state=(await res.json()).inspectionResult?.indexStatusResult;
 const verdict=state?.verdict||'UNKNOWN';
 const coverage=state?.coverageState||'Unknown';
 const indexed=verdict==='PASS';
 counts[indexed?'PASS':verdict==='UNKNOWN'?'UNKNOWN':'NOT_INDEXED']++;
 write('- '+inspectionUrl+' — '+verdict+'; '+coverage+'; last crawl: '+(state?.lastCrawlTime||'not reported'));
}
write('\nSample summary: indexed/PASS='+counts.PASS+', non-PASS='+counts.NOT_INDEXED+', unknown='+counts.UNKNOWN+'. Google data can lag; this does not submit URLs or guarantee indexing.');
