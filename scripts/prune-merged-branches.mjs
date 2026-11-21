/**
 * Post-deploy cleanup. Never delete a branch without a merged same-repo PR,
 * an unchanged head SHA, and proof that its merge commit is in live production.
 * Runs only from trusted main; no cron and no PR code checkout.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'duykhang68/techblogtip';
const RELEASE_URL = 'https://duykhang68.github.io/techblogtip/release.json';
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const MAX_PAGES = 20;
const MAX_DELETIONS = 150;
const RESERVED = /^(?:main|master|gh-pages|release\/|hotfix\/|backup\/|archive\/)/;

async function github(path, method = 'GET') {
  const response = await fetch('https://api.github.com/repos/' + REPOSITORY + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'techblogtip-postdeploy-prune',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('GitHub ' + method + ' ' + path + ': HTTP ' + response.status);
  if (response.status === 204) return null;
  return response.json();
}

async function collect(path) {
  const result = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await github(path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    if (!Array.isArray(rows)) throw new Error('Unexpected GitHub pagination response');
    result.push(...rows);
    if (rows.length < 100) return result;
  }
  throw new Error('GitHub pagination limit reached: refusing incomplete branch/PR audit');
}

function isDeployed(mergeSha, deploySha) {
  if (!SHA_PATTERN.test(mergeSha ?? '') || !SHA_PATTERN.test(deploySha ?? '')) return false;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', mergeSha, deploySha], { encoding: 'utf8' });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error('Git ancestry check failed: ' + (result.stderr || result.error?.message || result.status));
}

/** This conservative predicate is also tested independently of GitHub API. */
export function eligibleBranch(branch, prs, productionSha, ancestryCheck) {
  const name = branch?.name;
  if (typeof name !== 'string' || !/^[a-zA-Z0-9._/-]+$/.test(name) ||
      RESERVED.test(name) || branch.protected) return null;
  const linked = prs.filter(pr => pr.head?.repo?.full_name === REPOSITORY && pr.head?.ref === name);
  if (linked.length === 0) return null; // Includes unlinked Media/Sheets branches.
  if (prs.some(pr => pr.state === 'open' && pr.base?.repo?.full_name === REPOSITORY &&
        pr.base?.ref === name)) return null; // Keep bases of stacked open PRs.
  if (linked.some(pr => pr.state === 'open' || !pr.merged_at ||
        pr.head?.sha !== branch.commit?.sha)) return null;
  const integrated = linked.find(pr => pr.base?.ref === 'main' && pr.merged_at &&
    pr.merge_commit_sha && ancestryCheck(pr.merge_commit_sha, productionSha));
  return integrated ? { name, sha: branch.commit.sha, pr: integrated.number } : null;
}

async function run() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || !process.env.GH_TOKEN)
    throw new Error('Refusing unexpected repository or missing GitHub token');
  const releaseSha = process.env.SOURCE_SHA;
  if (!SHA_PATTERN.test(releaseSha ?? '')) throw new Error('Invalid deploy SHA');
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const run = event.workflow_run;
    if (run?.name !== 'Deploy · GitHub Pages production' || run?.event !== 'push' ||
        run?.conclusion !== 'success' || run?.head_branch !== 'main' ||
        run?.head_repository?.full_name !== REPOSITORY || run?.head_sha !== releaseSha)
      throw new Error('Refusing an untrusted or unsuccessful deployment event');
  } else if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('This job only accepts a successful deploy or explicit manual dispatch');
  }

  const live = await fetch(RELEASE_URL + '?verify=' + Date.now(), {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
  });
  if (!live.ok) throw new Error('Public release marker unavailable: HTTP ' + live.status);
  const marker = await live.json();
  if (marker.project !== 'techblogtip' || marker.ref !== 'main' ||
      !SHA_PATTERN.test(marker.sha ?? '') || marker.sha !== releaseSha) {
    console.log('SKIP: public release SHA differs from this run; no refs deleted');
    return;
  }
  // Actions checkout explicitly fetches the full, trusted main history.
  execFileSync('git', ['cat-file', '-e', releaseSha + '^{commit}']);
  const prs = await collect('/pulls?state=all');
  const branches = await collect('/branches');
  const candidates = branches.map(branch => eligibleBranch(branch, prs, releaseSha, isDeployed)).filter(Boolean);
  if (candidates.length > MAX_DELETIONS) throw new Error('Safety cap exceeded; review required');

  const dryRun = process.env.DRY_RUN !== 'false';
  const deleted = [], skipped = [];
  console.log('Production SHA:', releaseSha, '| branches:', branches.length,
    '| PRs:', prs.length, '| eligible:', candidates.length, '| dry-run:', dryRun);
  for (const candidate of candidates) {
    if (dryRun) {
      console.log('DRY RUN:', candidate.name, 'merged PR #' + candidate.pr);
      continue;
    }
    // Re-read the ref just before deletion. Never delete a newly advanced branch.
    const refPath = '/git/ref/heads/' + candidate.name.split('/').map(encodeURIComponent).join('/');
    const current = await github(refPath);
    if (current.ref !== 'refs/heads/' + candidate.name ||
        current.object?.sha !== candidate.sha) {
      skipped.push(candidate.name);
      console.log('SKIP changed ref:', candidate.name);
      continue;
    }
    await github('/git/refs/heads/' + candidate.name.split('/').map(encodeURIComponent).join('/'), 'DELETE');
    deleted.push(candidate.name);
    console.log('DELETED:', candidate.name, '(merged PR #' + candidate.pr + ')');
  }

  const mode = dryRun ? 'Dry run' : 'Cleanup';
  const lines = [
    '### ' + mode + ' of merged, deployed branches',
    '',
    '- Production SHA: \u0060' + releaseSha + '\u0060',
    '- GitHub branches inspected: ' + branches.length,
    '- Merged-to-main branches eligible: ' + candidates.length,
    '- Deleted: ' + deleted.length,
    '- Changed refs skipped: ' + skipped.length,
    '- Unmerged, unlinked, stacked-only, protected and open PR branches are preserved.',
  ];
  if (deleted.length) lines.push('', ...deleted.map(name => '- Deleted \u0060' + name + '\u0060'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
