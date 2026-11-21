import test from 'node:test';
import assert from 'node:assert/strict';
import { blankCv, duplicateCv, validateCv, ESSAY_KEYS, REPEATABLE_FIELDS } from '../src/lib/korea-cv-model.mjs';

test('blank CV contains no employer, applicant or historical template example data', () => {
  const cv = blankCv('test-cv-001');
  assert.deepEqual(validateCv(cv), []);
  assert.equal(cv.targetCompany, '');
  assert.equal(cv.targetRole, '');
  assert.equal(cv.content.personal.englishName, '');
  for (const key of ESSAY_KEYS) assert.equal(cv.content.essays[key], '');
  for (const key of REPEATABLE_FIELDS) assert.deepEqual(cv.content[key], []);
  assert.doesNotMatch(JSON.stringify(cv), /Samsung|Egina|Shell|990|홍길동/i);
});

test('rejects malformed payload and oversized entries', () => {
  const cv = blankCv('test-cv-002');
  cv.content.essays.motivation = 'x'.repeat(15001);
  assert.ok(validateCv(cv).length);
  cv.content.essays.motivation = '';
  cv.content.projects = [{ id: 'project-001', name: 'ABC', result: 'Validated actual achievement' }];
  assert.deepEqual(validateCv(cv), []);
  cv.content.projects[0].result = { forged: true };
  assert.ok(validateCv(cv).length);
});

test('duplicating an application removes target employer but retains editable master work', () => {
  const cv = blankCv('test-cv-003');
  cv.targetCompany = 'ABC';
  cv.targetRole = 'Engineer';
  cv.content.personal.englishName = 'Candidate';
  const copy = duplicateCv(cv, 'test-cv-004');
  assert.equal(copy.targetCompany, '');
  assert.equal(copy.targetRole, '');
  assert.equal(copy.content.personal.englishName, 'Candidate');
  assert.equal(copy.revision, 0);
  assert.deepEqual(validateCv(copy), []);
});
