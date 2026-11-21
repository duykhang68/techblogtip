import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleBranch } from '../scripts/prune-merged-branches.mjs';

const REPO = 'duykhang68/techblogtip';
const HEAD = 'a'.repeat(40);
const MERGE = 'b'.repeat(40);
const PROD = 'c'.repeat(40);
const branch = () => ({ name: 'fix/example-branch', protected: false, commit: { sha: HEAD } });
const merged = () => ({
  number: 99, state: 'closed', merged_at: '2026-11-21T17:00:00Z',
  merge_commit_sha: MERGE,
  base: { ref: 'main', repo: { full_name: REPO } },
  head: { ref: 'fix/example-branch', sha: HEAD, repo: { full_name: REPO } },
});
const integrated = (sha, deployed) => sha === MERGE && deployed === PROD;

test('deletes only an unchanged merged branch whose merge is deployed', () => {
  assert.deepEqual(eligibleBranch(branch(), [merged()], PROD, integrated),
    { name: 'fix/example-branch', sha: HEAD, pr: 99 });
});
test('retains a branch whose PR has not merged', () => {
  const pr = merged(); pr.merged_at = null;
  assert.equal(eligibleBranch(branch(), [pr], PROD, integrated), null);
});
test('retains a branch when production does not contain the merge', () => {
  assert.equal(eligibleBranch(branch(), [merged()], PROD, () => false), null);
});
test('retains a branch changed after the PR head was recorded', () => {
  const candidate = branch(); candidate.commit.sha = 'd'.repeat(40);
  assert.equal(eligibleBranch(candidate, [merged()], PROD, integrated), null);
});
test('retains branches used as bases of an open stacked PR', () => {
  const stacked = {
    state: 'open', base: { ref: 'fix/example-branch', repo: { full_name: REPO } },
    head: { ref: 'fix/stacked', sha: 'e'.repeat(40), repo: { full_name: REPO } },
  };
  assert.equal(eligibleBranch(branch(), [merged(), stacked], PROD, integrated), null);
});
test('retains standalone stacked branches not merged to main', () => {
  const pr = merged(); pr.base.ref = 'feat/other';
  assert.equal(eligibleBranch(branch(), [pr], PROD, integrated), null);
});
test('retains branches with another unmerged PR or no PR', () => {
  const cancelled = merged(); cancelled.state = 'closed'; cancelled.merged_at = null;
  assert.equal(eligibleBranch(branch(), [merged(), cancelled], PROD, integrated), null);
  assert.equal(eligibleBranch(branch(), [], PROD, integrated), null);
});
test('retains main, protected and reserved deployment branches', () => {
  assert.equal(eligibleBranch({ ...branch(), name: 'main' }, [merged()], PROD, integrated), null);
  assert.equal(eligibleBranch({ ...branch(), protected: true }, [merged()], PROD, integrated), null);
  assert.equal(eligibleBranch({ ...branch(), name: 'release/v1' }, [merged()], PROD, integrated), null);
});
