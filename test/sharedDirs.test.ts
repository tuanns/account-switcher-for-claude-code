import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureDirShared, ensureAllDirsShared, SHARED_SUBDIR_NAMES } from '../src/sharedDirs';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('ensureDirShared junctions a brand-new dirPath straight to the shared dir', () => {
  const dirPath = tempDir('cps-shared-new-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'plugins');

  ensureDirShared(dirPath, 'plugins', sharedDir);

  const linkPath = path.join(dirPath, 'plugins');
  assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);

  // Writing under the profile's subdir is visible from the shared dir.
  fs.writeFileSync(path.join(linkPath, 'marker.txt'), 'hello', 'utf8');
  assert.equal(fs.readFileSync(path.join(sharedDir, 'marker.txt'), 'utf8'), 'hello');
});

test('ensureDirShared merges an existing subdir into the shared dir, then junctions it', () => {
  const dirPath = tempDir('cps-shared-existing-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'skills');

  fs.mkdirSync(path.join(dirPath, 'skills', 'run-qms-tests'), { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'skills', 'run-qms-tests', 'SKILL.md'), '# old skill', 'utf8');

  ensureDirShared(dirPath, 'skills', sharedDir);

  const linkPath = path.join(dirPath, 'skills');
  assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
  assert.equal(
    fs.readFileSync(path.join(sharedDir, 'run-qms-tests', 'SKILL.md'), 'utf8'),
    '# old skill'
  );
  assert.equal(
    fs.readFileSync(path.join(linkPath, 'run-qms-tests', 'SKILL.md'), 'utf8'),
    '# old skill'
  );
});

test('ensureDirShared keeps existing shared-dir content when a file with the same name already exists there', () => {
  const dirPath = tempDir('cps-shared-conflict-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'projects');
  const slug = 'c--repo';

  fs.mkdirSync(path.join(sharedDir, slug), { recursive: true });
  fs.writeFileSync(path.join(sharedDir, slug, 'session-a.jsonl'), '{"shared":"wins"}', 'utf8');

  fs.mkdirSync(path.join(dirPath, 'projects', slug), { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'projects', slug, 'session-a.jsonl'), '{"local":"loses"}', 'utf8');

  ensureDirShared(dirPath, 'projects', sharedDir);

  const merged = fs.readFileSync(path.join(sharedDir, slug, 'session-a.jsonl'), 'utf8');
  assert.equal(merged, '{"shared":"wins"}');
});

test('ensureDirShared is a no-op when already junctioned', () => {
  const dirPath = tempDir('cps-shared-idempotent-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'plugins');

  ensureDirShared(dirPath, 'plugins', sharedDir);
  ensureDirShared(dirPath, 'plugins', sharedDir);

  assert.equal(fs.lstatSync(path.join(dirPath, 'plugins')).isSymbolicLink(), true);
});

test('ensureAllDirsShared junctions every entry in SHARED_SUBDIR_NAMES', () => {
  const dirPath = tempDir('cps-shared-all-');
  const sharedRoot = tempDir('cps-shared-all-root-');

  ensureAllDirsShared(dirPath, (name) => path.join(sharedRoot, name));

  for (const name of SHARED_SUBDIR_NAMES) {
    assert.equal(fs.lstatSync(path.join(dirPath, name)).isSymbolicLink(), true, `${name} should be a junction`);
  }
});
