import publisher from './index.mjs';
import { DurableObject } from 'cloudflare:workers';

// Keep cloudflare:workers out of index.mjs so Node contract tests can import
// the request handler without a runtime shim.
export default publisher;

export class SourceWriteLock extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS lease (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, expires INTEGER NOT NULL)');
    });
  }

  // Atomic statements with no await between reading and writing.
  // The object is keyed by source ID and shared globally among Worker isolates.
  async acquire(token,ttlMs){
    if(typeof token!=='string'||!/^[-a-f0-9]{36}$/.test(token)||ttlMs!==120000)
      return false;
    const now=Date.now();
    const rows=this.ctx.storage.sql.exec('SELECT token, expires FROM lease WHERE id = 1').toArray();
    if(rows.length&&Number(rows[0].expires)>now)return false;
    this.ctx.storage.sql.exec('INSERT INTO lease (id, token, expires) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET token=excluded.token, expires=excluded.expires',token,now+ttlMs);
    return true;
  }

  async release(token){
    if(typeof token!=='string'||!/^[-a-f0-9]{36}$/.test(token))return false;
    const result=this.ctx.storage.sql.exec('DELETE FROM lease WHERE id = 1 AND token = ?',token);
    return result.rowsWritten>0;
  }
}
