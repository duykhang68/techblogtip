import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sha=process.env.GITHUB_SHA || 'local';
if(process.env.GITHUB_ACTIONS==='true' && !/^[0-9a-f]{40}$/.test(sha)) throw new Error('Expected 40-character GITHUB_SHA');
mkdirSync('dist',{recursive:true});
const release={sha, ref:process.env.GITHUB_REF_NAME||'local',builtAt:new Date().toISOString(),project:'techblogtip'};
writeFileSync(resolve('dist/release.json'),JSON.stringify(release,null,2)+'\n','utf8');
console.log('Release marker created for '+sha);
