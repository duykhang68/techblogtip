import { fail } from './auth.mjs';

const SOURCE_PATTERN=/^TBT-[A-Za-z0-9-]{8,80}$/;
const LEASE_MS=120000;

// Use a deterministic Durable Object instance for each Sheet source.
// A missing namespace is a hard error, not a silent fallback to in-memory locks.
export async function withSourceWriteLock(env,sourceId,task){
  if(typeof sourceId!=='string'||!SOURCE_PATTERN.test(sourceId))
    fail(400,'source_invalid','System-issued source ID required');
  if(!env.SOURCE_LOCKS||typeof env.SOURCE_LOCKS.getByName!=='function')
    fail(503,'source_lock_unconfigured','Source write coordination is unavailable');
  const spreadsheet=String(env.SHEETS_SPREADSHEET_ID||'');
  const gid=String(env.SHEETS_GID||'');
  if(!/^[A-Za-z0-9_-]{15,150}$/.test(spreadsheet)||!/^\d+$/.test(gid))
    fail(503,'sheet_not_configured','Source lock cannot identify the Sheet');
  const stub=env.SOURCE_LOCKS.getByName(spreadsheet+':'+gid+':source:'+sourceId);
  const nonce=crypto.randomUUID();
  let locked;
  try{locked=await stub.acquire(nonce,LEASE_MS);}catch{
    fail(503,'source_lock_unavailable','Cannot coordinate source writes');
  }
  if(!locked)fail(409,'source_busy','This article is being saved or submitted. Retry after the other operation finishes.');
  try{return await task();}
  finally{
    try{await stub.release(nonce);}catch{
      // The lease expires on its own after LEASE_MS; do not misreport a
      // successful external Sheets/GitHub write as a failure.
      console.error(JSON.stringify({event:'source_lock_release_failed'}));
    }
  }
}

// ID allocation has no source ID yet. Lock its pinned row number separately.
export async function withRowWriteLock(env,rowNumber,task){
  if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>200)
    fail(400,'row_invalid','Invalid Google Sheet row number');
  if(!env.SOURCE_LOCKS||typeof env.SOURCE_LOCKS.getByName!=='function')
    fail(503,'source_lock_unconfigured','Source write coordination is unavailable');
  const sheet=String(env.SHEETS_SPREADSHEET_ID||'');
  const gid=String(env.SHEETS_GID||'');
  if(!/^[A-Za-z0-9_-]{15,150}$/.test(sheet)||!/^\d+$/.test(gid))
    fail(503,'sheet_not_configured','Source lock cannot identify the Sheet');
  const stub=env.SOURCE_LOCKS.getByName(sheet+':'+gid+':row:'+rowNumber);
  const nonce=crypto.randomUUID();
  let ok;
  try{ok=await stub.acquire(nonce,LEASE_MS);}catch{
    fail(503,'source_lock_unavailable','Cannot coordinate source writes');
  }
  if(!ok)fail(409,'source_busy','Source ID allocation is already in progress');
  try{return await task();}
  finally{try{await stub.release(nonce);}catch{console.error(JSON.stringify({event:'source_lock_release_failed'}));}}
}
