import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isCredentialsWiped } from '../src/credentialsHealth';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('isCredentialsWiped is false when the file does not exist (never logged in)', () => {
  const dirPath = tempDir('cps-health-missing-');
  assert.equal(isCredentialsWiped(dirPath), false);
});

test('isCredentialsWiped is false for a normal credentials file', () => {
  const dirPath = tempDir('cps-health-ok-');
  fs.writeFileSync(
    path.join(dirPath, '.credentials.json'),
    JSON.stringify({ claudeAiOauth: { accessToken: 'abc', refreshToken: 'def', expiresAt: 9999999999999 } }),
    'utf8'
  );
  assert.equal(isCredentialsWiped(dirPath), false);
});

test('isCredentialsWiped is true when both tokens are empty strings (nested under claudeAiOauth)', () => {
  const dirPath = tempDir('cps-health-wiped-nested-');
  fs.writeFileSync(
    path.join(dirPath, '.credentials.json'),
    JSON.stringify({ claudeAiOauth: { accessToken: '', refreshToken: '', expiresAt: 0 } }),
    'utf8'
  );
  assert.equal(isCredentialsWiped(dirPath), true);
});

test('isCredentialsWiped is true when both tokens are empty strings (flat shape)', () => {
  const dirPath = tempDir('cps-health-wiped-flat-');
  fs.writeFileSync(
    path.join(dirPath, '.credentials.json'),
    JSON.stringify({ accessToken: '', refreshToken: '' }),
    'utf8'
  );
  assert.equal(isCredentialsWiped(dirPath), true);
});

test('isCredentialsWiped is false when the file is unparseable (different problem, not this one)', () => {
  const dirPath = tempDir('cps-health-corrupt-');
  fs.writeFileSync(path.join(dirPath, '.credentials.json'), '{not json', 'utf8');
  assert.equal(isCredentialsWiped(dirPath), false);
});
