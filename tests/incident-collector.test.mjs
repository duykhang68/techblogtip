import test from 'node:test';
import assert from 'node:assert/strict';
import { actionable, marker, failedSteps, fingerprint, knownRuns, annotated, synopsis, newBody } from '../scripts/collect-ci-incidents.mjs';

const run = {
  id: 44762948926, run_attempt: 1, workflow_id: 425135708,
  name: 'Quality', conclusion: 'failure', event: 'pull_request',
  head_branch: 'dependabot/npm_and_yarn/typescript-7.0.2',
  head_sha: 'b1a8ed9f0341c14774ca9ca8241195b49e80aa65',
  html_url: 'https://github.com/duykhang68/techblogtip/actions/runs/44762948926',
  created_at: '2026-11-20T15:24:26Z'
};
const jobs = [{
  name: 'Astro · Types · Content · Build', conclusion: 'failure',
  steps: [
    { name: 'Install dependencies', conclusion: 'failure' },
    { name: 'Validate, test and build', conclusion: 'skipped' }
  ]
}];

test('only monitored failure states trigger collection', () => {
  assert.equal(actionable(run), true);
  assert.equal(actionable({ ...run, conclusion: 'success' }), false);
  assert.equal(actionable({ ...run, name: 'CI Incident Collector' }), false);
  assert.equal(actionable({ ...run, conclusion: 'timed_out' }), true);
});
test('failure signatures deduplicate by workflow, branch, and failing step', () => {
  assert.equal(fingerprint(run, jobs), fingerprint({ ...run, id: 123 }, jobs));
  assert.notEqual(fingerprint(run, jobs), fingerprint({ ...run, head_branch: 'main' }, jobs));
  const changed = [{ ...jobs[0], steps: [{ name: 'Build', conclusion: 'failure' }] }];
  assert.notEqual(fingerprint(run, jobs), fingerprint(run, changed));
});
test('recurrence markers remain unique and idempotent', () => {
  const key = fingerprint(run, jobs);
  const original = newBody(run, jobs, key);
  assert.deepEqual(knownRuns(original), ['44762948926#1']);
  const updated = annotated(original, key, [...knownRuns(original), marker(run), '13#2']);
  assert.deepEqual(knownRuns(updated), ['44762948926#1', '13#2']);
  assert.equal(updated.match(/<!-- ci-key:/g).length, 1);
});
test('incident summary includes run and step without copying raw logs', () => {
  assert.equal(failedSteps(jobs)[0].step, 'Install dependencies');
  const text = synopsis(run, jobs);
  assert.match(text, /b1a8ed9f/);
  assert.match(text, /Install dependencies/);
  assert.match(text, /44762948926/);
  assert.doesNotMatch(text, /password|secret token/i);
});
