import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { swapCredentialsIntoLive } from '../src/liveSwap';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('swapCredentialsIntoLive copies .credentials.json into the live dir', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = path.join(tempDir('cps-swap-live-'), 'live');
  fs.writeFileSync(path.join(sourceDir, '.credentials.json'), '{"token":"abc"}', 'utf8');

  swapCredentialsIntoLive(sourceDir, liveDir);

  const copied = fs.readFileSync(path.join(liveDir, '.credentials.json'), 'utf8');
  assert.equal(copied, '{"token":"abc"}');
});

test('swapCredentialsIntoLive merges only oauthAccount into an existing .claude.json, keeping other keys', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = tempDir('cps-swap-live-');
  fs.writeFileSync(path.join(sourceDir, '.credentials.json'), '{"token":"abc"}', 'utf8');
  fs.writeFileSync(
    path.join(sourceDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'new@example.com' }, projects: { should: 'not-copy' } }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(liveDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'old@example.com' }, projects: { keep: 'me' } }),
    'utf8'
  );

  swapCredentialsIntoLive(sourceDir, liveDir);

  const dst = JSON.parse(fs.readFileSync(path.join(liveDir, '.claude.json'), 'utf8'));
  assert.equal(dst.oauthAccount.emailAddress, 'new@example.com');
  assert.deepEqual(dst.projects, { keep: 'me' });
});

test('swapCredentialsIntoLive copies the whole .claude.json (incl. projects) when the live dir has none yet', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = path.join(tempDir('cps-swap-live-'), 'fresh-live');
  fs.writeFileSync(path.join(sourceDir, '.credentials.json'), '{"token":"abc"}', 'utf8');
  fs.writeFileSync(
    path.join(sourceDir, '.claude.json'),
    JSON.stringify({
      oauthAccount: { emailAddress: 'new@example.com' },
      projects: { 'C:\\repo': { history: ['old session'] } },
    }),
    'utf8'
  );

  swapCredentialsIntoLive(sourceDir, liveDir);

  const dst = JSON.parse(fs.readFileSync(path.join(liveDir, '.claude.json'), 'utf8'));
  assert.equal(dst.oauthAccount.emailAddress, 'new@example.com');
  assert.deepEqual(dst.projects, { 'C:\\repo': { history: ['old session'] } });
});

test('swapCredentialsIntoLive is a no-op when the live dir has no .claude.json yet and the source has none either', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = path.join(tempDir('cps-swap-live-'), 'fresh-live');
  fs.writeFileSync(path.join(sourceDir, '.credentials.json'), '{"token":"abc"}', 'utf8');

  swapCredentialsIntoLive(sourceDir, liveDir);

  assert.equal(fs.existsSync(path.join(liveDir, '.claude.json')), false);
});

test('swapCredentialsIntoLive throws a clear error when the source has no credentials file', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = tempDir('cps-swap-live-');
  assert.throws(() => swapCredentialsIntoLive(sourceDir, liveDir), /credentials/i);
});

test('swapCredentialsIntoLive is a no-op on projects/mcpServers/etc. when source .claude.json has no oauthAccount', () => {
  const sourceDir = tempDir('cps-swap-src-');
  const liveDir = tempDir('cps-swap-live-');
  fs.writeFileSync(path.join(sourceDir, '.credentials.json'), '{"token":"abc"}', 'utf8');
  fs.writeFileSync(path.join(liveDir, '.claude.json'), JSON.stringify({ projects: { keep: 'me' } }), 'utf8');

  swapCredentialsIntoLive(sourceDir, liveDir);

  const dst = JSON.parse(fs.readFileSync(path.join(liveDir, '.claude.json'), 'utf8'));
  assert.deepEqual(dst.projects, { keep: 'me' });
  assert.equal(dst.oauthAccount, undefined);
});
