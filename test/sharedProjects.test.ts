import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureProjectsShared } from '../src/sharedProjects';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('ensureProjectsShared junctions a brand-new dirPath straight to the shared dir', () => {
  const dirPath = tempDir('cps-shared-new-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'projects');

  ensureProjectsShared(dirPath, sharedDir);

  const linkPath = path.join(dirPath, 'projects');
  assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);

  // Writing under the profile's `projects/` is visible from the shared dir.
  fs.writeFileSync(path.join(linkPath, 'marker.txt'), 'hello', 'utf8');
  assert.equal(fs.readFileSync(path.join(sharedDir, 'marker.txt'), 'utf8'), 'hello');
});

test('ensureProjectsShared merges an existing projects dir into the shared dir, then junctions it', () => {
  const dirPath = tempDir('cps-shared-existing-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'projects');
  const projectSlug = 'c--repo';

  fs.mkdirSync(path.join(dirPath, 'projects', projectSlug), { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, 'projects', projectSlug, 'session-a.jsonl'),
    '{"old":"session"}',
    'utf8'
  );

  ensureProjectsShared(dirPath, sharedDir);

  const linkPath = path.join(dirPath, 'projects');
  assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
  const migrated = fs.readFileSync(
    path.join(sharedDir, projectSlug, 'session-a.jsonl'),
    'utf8'
  );
  assert.equal(migrated, '{"old":"session"}');
  // And it's still readable through the (now-junctioned) original path.
  assert.equal(
    fs.readFileSync(path.join(linkPath, projectSlug, 'session-a.jsonl'), 'utf8'),
    '{"old":"session"}'
  );
});

test('ensureProjectsShared keeps existing shared-dir content when a file with the same name already exists there', () => {
  const dirPath = tempDir('cps-shared-conflict-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'projects');
  const projectSlug = 'c--repo';

  fs.mkdirSync(path.join(sharedDir, projectSlug), { recursive: true });
  fs.writeFileSync(path.join(sharedDir, projectSlug, 'session-a.jsonl'), '{"shared":"wins"}', 'utf8');

  fs.mkdirSync(path.join(dirPath, 'projects', projectSlug), { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, 'projects', projectSlug, 'session-a.jsonl'),
    '{"local":"loses"}',
    'utf8'
  );

  ensureProjectsShared(dirPath, sharedDir);

  const merged = fs.readFileSync(path.join(sharedDir, projectSlug, 'session-a.jsonl'), 'utf8');
  assert.equal(merged, '{"shared":"wins"}');
});

test('ensureProjectsShared is a no-op when already junctioned', () => {
  const dirPath = tempDir('cps-shared-idempotent-');
  const sharedDir = path.join(tempDir('cps-shared-root-'), 'projects');

  ensureProjectsShared(dirPath, sharedDir);
  // Calling again should not throw, and should leave the junction in place.
  ensureProjectsShared(dirPath, sharedDir);

  assert.equal(fs.lstatSync(path.join(dirPath, 'projects')).isSymbolicLink(), true);
});
