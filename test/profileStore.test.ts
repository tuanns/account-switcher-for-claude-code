import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addProfile,
  listProfiles,
  findProfile,
  renameProfile,
  removeProfile,
  readProfilesFile,
} from '../src/profileStore';

function tempProfilesJsonPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-store-'));
  return path.join(dir, 'profiles.json');
}

test('listProfiles returns empty array when file does not exist', () => {
  const p = tempProfilesJsonPath();
  assert.deepEqual(listProfiles(p), []);
});

test('addProfile creates a profile with id and createdAt, persists to disk', () => {
  const p = tempProfilesJsonPath();
  const profile = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  assert.equal(profile.name, 'Work');
  assert.equal(profile.dirPath, 'C:\\fake\\work');
  assert.ok(profile.id);
  assert.ok(profile.createdAt);
  assert.equal(listProfiles(p).length, 1);
  assert.deepEqual(findProfile(p, profile.id), profile);
});

test('addProfile rejects duplicate name case-insensitively', () => {
  const p = tempProfilesJsonPath();
  addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  assert.throws(() => addProfile(p, { name: 'work', dirPath: 'C:\\fake\\other' }));
});

test('renameProfile updates name and rejects clash with another profile', () => {
  const p = tempProfilesJsonPath();
  const a = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  addProfile(p, { name: 'Personal', dirPath: 'C:\\fake\\personal' });
  renameProfile(p, a.id, 'Work2');
  assert.equal(findProfile(p, a.id)?.name, 'Work2');
  assert.throws(() => renameProfile(p, a.id, 'Personal'));
});

test('removeProfile deletes the entry and throws for unknown id', () => {
  const p = tempProfilesJsonPath();
  const a = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  removeProfile(p, a.id);
  assert.equal(listProfiles(p).length, 0);
  assert.throws(() => removeProfile(p, a.id));
});

test('readProfilesFile recovers from a corrupt file by backing it up and starting fresh', () => {
  const p = tempProfilesJsonPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '{ not valid json', 'utf8');
  const data = readProfilesFile(p);
  assert.deepEqual(data.profiles, []);
  assert.ok(fs.existsSync(`${p}.bak`));
  assert.equal(fs.readFileSync(`${p}.bak`, 'utf8'), '{ not valid json');
});
