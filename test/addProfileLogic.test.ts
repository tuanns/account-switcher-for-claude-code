import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateNewProfileName, waitForCredentialsFile } from '../src/addProfileLogic';
import type { ClaudeProfile } from '../src/profileStore';

function makeProfile(name: string): ClaudeProfile {
  return { id: name, name, dirPath: `C:\\fake\\${name}`, createdAt: new Date().toISOString() };
}

test('validateNewProfileName rejects empty name', () => {
  assert.equal(validateNewProfileName('   ', []), 'Tên profile không được để trống');
});

test('validateNewProfileName rejects duplicate name case-insensitively', () => {
  assert.equal(
    validateNewProfileName('work', [makeProfile('Work')]),
    'Đã có profile tên "work"'
  );
});

test('validateNewProfileName accepts a unique non-empty name', () => {
  assert.equal(validateNewProfileName('Personal', [makeProfile('Work')]), undefined);
});

test('waitForCredentialsFile resolves true once the file appears', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-wait-'));
  const filePath = path.join(dir, '.credentials.json');
  setTimeout(() => fs.writeFileSync(filePath, '{}', 'utf8'), 300);
  const result = await waitForCredentialsFile(filePath, 5000, 100);
  assert.equal(result, true);
});

test('waitForCredentialsFile resolves false after timeout when file never appears', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-wait-'));
  const filePath = path.join(dir, '.credentials.json');
  const result = await waitForCredentialsFile(filePath, 300, 100);
  assert.equal(result, false);
});
