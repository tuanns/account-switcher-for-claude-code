import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { slugify, getUniqueProfileDirPath } from '../src/paths';

test('slugify lowercases and replaces non-alphanumeric with dashes', () => {
  assert.equal(slugify('Work Account'), 'work-account');
});

test('slugify collapses repeated separators and trims edges', () => {
  assert.equal(slugify('  Hello!!  World??  '), 'hello-world');
});

test('slugify falls back to "profile" when nothing alphanumeric remains', () => {
  assert.equal(slugify('!!!'), 'profile');
});

test('getUniqueProfileDirPath returns base slug path when free', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-test-'));
  const result = getUniqueProfileDirPath('Work', root);
  assert.equal(result, path.join(root, 'work'));
});

test('getUniqueProfileDirPath appends numeric suffix when slug taken', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-test-'));
  fs.mkdirSync(path.join(root, 'work'));
  const result = getUniqueProfileDirPath('Work', root);
  assert.equal(result, path.join(root, 'work-2'));
});
