import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, readProfilesFile } from '../src/profileStore';
import { refreshProfilesAccountCache } from '../src/accountCache';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('refreshProfilesAccountCache backfills email/organizationName missing from creation time', () => {
  const root = tempDir('cps-cache-backfill-');
  const profilesJsonPath = path.join(root, 'profiles.json');
  const dirPath = path.join(root, 'default');
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'a@example.com', organizationName: 'Acme' } }),
    'utf8'
  );
  addProfile(profilesJsonPath, { name: 'Default', dirPath }); // no email/org cached yet

  const refreshed = refreshProfilesAccountCache(profilesJsonPath);

  assert.equal(refreshed[0].email, 'a@example.com');
  assert.equal(refreshed[0].organizationName, 'Acme');
  const onDisk = readProfilesFile(profilesJsonPath).profiles[0];
  assert.equal(onDisk.email, 'a@example.com');
});

test('refreshProfilesAccountCache updates a stale cached email to the current one', () => {
  const root = tempDir('cps-cache-stale-');
  const profilesJsonPath = path.join(root, 'profiles.json');
  const dirPath = path.join(root, 'work');
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'new@example.com' } }),
    'utf8'
  );
  addProfile(profilesJsonPath, { name: 'Work', dirPath, email: 'old@example.com' });

  const refreshed = refreshProfilesAccountCache(profilesJsonPath);

  assert.equal(refreshed[0].email, 'new@example.com');
});

test('refreshProfilesAccountCache leaves the cached value alone when dirPath has no oauthAccount', () => {
  const root = tempDir('cps-cache-noop-');
  const profilesJsonPath = path.join(root, 'profiles.json');
  const dirPath = path.join(root, 'ghost');
  fs.mkdirSync(dirPath, { recursive: true }); // no .claude.json at all
  addProfile(profilesJsonPath, { name: 'Ghost', dirPath, email: 'kept@example.com' });

  const refreshed = refreshProfilesAccountCache(profilesJsonPath);

  assert.equal(refreshed[0].email, 'kept@example.com');
});

test('refreshProfilesAccountCache does not rewrite the file when nothing changed', () => {
  const root = tempDir('cps-cache-untouched-');
  const profilesJsonPath = path.join(root, 'profiles.json');
  const dirPath = path.join(root, 'stable');
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'same@example.com' } }),
    'utf8'
  );
  addProfile(profilesJsonPath, { name: 'Stable', dirPath, email: 'same@example.com' });
  const mtimeBefore = fs.statSync(profilesJsonPath).mtimeMs;

  refreshProfilesAccountCache(profilesJsonPath);

  assert.equal(fs.statSync(profilesJsonPath).mtimeMs, mtimeBefore);
});
