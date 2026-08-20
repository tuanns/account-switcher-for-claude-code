import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, listProfiles } from '../src/profileStore';
import { tryFirstRunMigration } from '../src/migration';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('tryFirstRunMigration does nothing when no existing login found', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.equal(result, undefined);
  assert.deepEqual(listProfiles(profilesJsonPath), []);
});

test('tryFirstRunMigration imports existing ~/.claude as a Default profile', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}', 'utf8');
  fs.writeFileSync(
    path.join(claudeDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'me@example.com', organizationName: 'Acme' } }),
    'utf8'
  );
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.ok(result);
  assert.equal(result?.name, 'Default');
  assert.equal(result?.dirPath, claudeDir);
  assert.equal(result?.email, 'me@example.com');
  assert.equal(result?.organizationName, 'Acme');
  assert.equal(listProfiles(profilesJsonPath).length, 1);
});

test('tryFirstRunMigration skips when a profile already exists', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}', 'utf8');
  addProfile(profilesJsonPath, { name: 'Existing', dirPath: 'C:\\fake' });
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.equal(result, undefined);
  assert.equal(listProfiles(profilesJsonPath).length, 1);
});
