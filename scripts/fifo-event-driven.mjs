// FIFO · event-driven admission, no dependencies, no polling and no PR code execution.
// Deliberately only admits PRs targeting main. Feature-branch chains require a separate
// integration step; silent feature-to-feature merges would not deploy to production.
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== (process.env.EXPECTED_REPOSITORY || 'duykhang68/techblogtip')) throw new Error('Unexpected repository');
const token = process.env.GH_TOKEN;
if (!token) throw new Error('Missing GitHub token');
const api = 'https://api.github.com/repos/' + repository;
const headers = {
  Authorization: 'Bearer ' + token,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};
async function get(url) {
  const response = await fetch(url.startsWith('https://') ? url : api + url, { headers });
  if (!response.ok) throw new Error('GitHub API HTTP ' + response.status + ': ' + (await response.text()).slice(0,300));
  return response.json();
}
async function merge(pr) {
  const response = await fetch(api + '/pulls/' + pr.number + '/merge', {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: pr.head.sha, merge_method: 'squash' }),
  });
  if (!response.ok) throw new Error('Merge rejected HTTP ' + response.status + ': ' + (await response.text()).slice(0,600));
  return response.json();
}
function notice(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    import('node:fs').then(({ appendFileSync }) => appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n'));
  }
}
async function allOpen() {
  const prs = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await get('/pulls?state=open&sort=created&direction=asc&per_page=100&page=' + page);
    prs.push(...batch);
    if (batch.length < 100) return prs;
  }
  throw new Error('FIFO listing exceeded 1000 PRs; refusing partial queue');
}
const queue = await allOpen();
queue.sort((a,b) => new Date(a.created_at) - new Date(b.created_at) || a.number - b.number);
const first = queue[0];
if (!first) { notice('FIFO empty; no merge needed'); process.exit(0); }
notice('FIFO candidate #' + first.number + ' head=' + first.head.sha + ' base=' + first.base.ref);
if (first.draft) { notice('BLOCKED: oldest PR is Draft; do not skip FIFO'); process.exit(0); }
if (first.base.ref !== 'main') { notice('BLOCKED: oldest PR targets a feature branch; explicit retarget/integration is required'); process.exit(0); }
const main = await get('/branches/main');
const mainSha = main.commit.sha;
// Never start a new merge before the last main commit is verified in production.
const releases = await get('/actions/workflows/deploy-production.yml/runs?branch=main&event=push&per_page=20');
const release = releases.workflow_runs.find(run => run.head_sha === mainSha);
if (!release || release.status !== 'completed' || release.conclusion !== 'success') {
  notice('WAIT: production workflow is not successful at main=' + mainSha); process.exit(0);
}
const qualityMain = await get('/actions/workflows/quality.yml/runs?branch=main&event=push&per_page=20');
if (!qualityMain.workflow_runs.some(run => run.head_sha === mainSha && run.status === 'completed' && run.conclusion === 'success')) {
  notice('WAIT: main Quality has not passed at ' + mainSha); process.exit(0);
}
const live = await fetch('https://duykhang68.github.io/techblogtip/release.json', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
if (!live.ok) { notice('WAIT: live release.json HTTP ' + live.status); process.exit(0); }
const releaseJson = await live.json();
if (releaseJson.sha !== mainSha) { notice('WAIT: production SHA mismatch live=' + releaseJson.sha + ' main=' + mainSha); process.exit(0); }
// GitHub head-SHA checks are required; no trusting stale PR checks or branch-only success.
const checks = await get('/commits/' + first.head.sha + '/check-runs?per_page=100&filter=latest');
const byName = new Map(checks.check_runs.map(x => [x.name, x]));
for (const name of ['Astro · Types · Content · Build', 'Gitleaks · No leaked secrets']) {
  const check = byName.get(name);
  if (!check || check.status !== 'completed' || check.conclusion !== 'success') {
    notice('WAIT: required head-SHA check not PASS: ' + name); process.exit(0);
  }
}
const changed = [];
for (let page = 1; page <= 10; page++) {
  const files = await get('/pulls/' + first.number + '/files?per_page=100&page=' + page);
  changed.push(...files);
  if (files.length < 100) break;
  if (page === 10) throw new Error('PR has too many files; refuse incomplete security audit');
}
if (changed.some(file => file.filename.startsWith('.github/workflows/') || file.filename === '.github/dependabot.yml')) {
  const audit = byName.get('Audit GitHub Actions security');
  if (!audit || audit.status !== 'completed' || audit.conclusion !== 'success') {
    notice('WAIT: workflow security audit not PASS'); process.exit(0);
  }
}
// Do not silently bypass other failed or pending checks associated with this head.
const blocking = checks.check_runs.filter(x =>
  x.name !== 'FIFO · Admission' &&
  (x.status !== 'completed' || !['success', 'skipped', 'neutral'].includes(x.conclusion))
);
if (blocking.length) { notice('WAIT: unresolved head checks: ' + blocking.map(x => x.name + '=' + (x.conclusion || x.status)).join(', ')); process.exit(0); }
// Re-read PR and main to mitigate webhook races; REST merge itself guards exact head SHA.
const refreshed = await get('/pulls/' + first.number);
const currentMain = await get('/branches/main');
if (refreshed.state !== 'open' || refreshed.draft || refreshed.head.sha !== first.head.sha ||
    refreshed.base.ref !== 'main' || currentMain.commit.sha !== mainSha) {
  notice('WAIT: PR/main moved during admission; a newer event will reevaluate'); process.exit(0);
}
if (refreshed.mergeable !== true || refreshed.mergeable_state !== 'clean') {
  notice('WAIT: GitHub mergeability is ' + refreshed.mergeable_state); process.exit(0);
}
const result = await merge(refreshed);
if (!result.merged) throw new Error('GitHub did not confirm merged=true');
notice('MERGED #' + first.number + ' ' + result.sha + ' — wait for next production completion event');
