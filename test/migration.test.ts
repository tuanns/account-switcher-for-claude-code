import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, listProfiles } from '../src/profileStore';
import { tryFirstRunMigration } from '../src/migration';
import { SHARED_SUBDIR_NAMES } from '../src/sharedDirs';

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
  const sharedRoot = tempDir('cps-shared-root-');
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir, (name) =>
    path.join(sharedRoot, name)
  );
  assert.ok(result);
  assert.equal(result?.name, 'Default');
  assert.equal(result?.dirPath, claudeDir);
  assert.equal(result?.email, 'me@example.com');
  assert.equal(result?.organizationName, 'Acme');
  assert.equal(listProfiles(profilesJsonPath).length, 1);
});

test('tryFirstRunMigration shares claudeDir\'s own projects/plugins/skills, not just an empty target', () => {
  // Regression test: a pre-existing ~/.claude that already had real session
  // history/plugins/skills (from being used before this extension was ever
  // installed) must not get orphaned - see the fix in migration.ts for why
  // extension.ts's own post-migration call alone doesn't cover this case
  // (it targets `_live`, not claudeDir, in the default/unpinned mode).
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}', 'utf8');
  fs.mkdirSync(path.join(claudeDir, 'projects', 'my-old-project'), { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, 'projects', 'my-old-project', 'session.jsonl'),
    '{"pre-existing":"session"}',
    'utf8'
  );

  const sharedRoot = tempDir('cps-shared-root-');
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir, (name) =>
    path.join(sharedRoot, name)
  );

  assert.ok(result);
  for (const name of SHARED_SUBDIR_NAMES) {
    assert.equal(
      fs.lstatSync(path.join(claudeDir, name)).isSymbolicLink(),
      true,
      `${name} should be a junction after migration`
    );
  }
  assert.equal(
    fs.readFileSync(
      path.join(sharedRoot, 'projects', 'my-old-project', 'session.jsonl'),
      'utf8'
    ),
    '{"pre-existing":"session"}'
  );
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
