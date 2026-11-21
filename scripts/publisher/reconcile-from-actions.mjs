// Fired only after verified production deploy; no cron or client-side tokens.
const base='https://techblogtip-publisher-dev.tamsudev-com.workers.dev';
const token=String(process.env.TBT_PRODUCTION_SYNC_TOKEN||'');
const runId=Number(process.env.PRODUCTION_RUN_ID);
const releaseSha=String(process.env.PRODUCTION_RELEASE_SHA||'');
if(token.length<32||!Number.isSafeInteger(runId)||runId<1||
   !/^[a-f0-9]{40}$/.test(releaseSha))
  throw new Error('Protected production callback configuration is incomplete');
let cursor=1,more=true;
for(let page=0;page<45&&more;page++){
  const res=await fetch(base+'/api/reconcile-production',{
    method:'POST',redirect:'manual',headers:{
      'Authorization':'Bearer '+token,'Content-Type':'application/json'
    },body:JSON.stringify({runId,releaseSha,cursor}),
    signal:AbortSignal.timeout(30000),
  });
  if(res.status!==200){
    // Report only the Worker's non-sensitive error code, never bearer tokens.
    const detail=await res.json().catch(()=>null);
    const code=typeof detail?.error==='string'&&
      /^[a-z][a-z0-9_]{1,63}$/.test(detail.error)?' ['+detail.error+']':'';
    throw new Error('Production sync endpoint HTTP '+res.status+code+
      '. Pages SHA verification passed, but Sheets writeback did not complete.');
  }
  const response=await res.json();
  if(!Number.isInteger(response.nextCursor)||response.nextCursor<cursor||
     typeof response.hasMore!=='boolean'||!Array.isArray(response.results))
    throw new Error('Malformed production reconciliation response');
  const written=response.results.filter(x=>x.state==='written').length;
  console.log('Production batch '+(page+1)+': verified '+written+
     ', pending '+(response.results.length-written));
  if(response.hasMore&&response.nextCursor===cursor)
    throw new Error('Production reconciliation stalled');
  cursor=response.nextCursor;
  more=response.hasMore;
}
if(more)throw new Error('Production synchronization exceeded bounded pagination');
console.log('Production reconciliation finished; only verified articles written');
