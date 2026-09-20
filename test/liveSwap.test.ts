import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { swapCredentialsIntoLive, writeBackLiveCredentials } from '../src/liveSwap';

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

function seedLive(liveDir: string, email: string, creds: unknown): void {
  fs.writeFileSync(path.join(liveDir, '.credentials.json'), JSON.stringify(creds), 'utf8');
  fs.writeFileSync(path.join(liveDir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: email } }), 'utf8');
}

test('writeBackLiveCredentials copies refreshed live credentials into the outgoing profile when emails match', () => {
  const outDir = tempDir('cps-wb-out-');
  const liveDir = tempDir('cps-wb-live-');
  fs.writeFileSync(path.join(outDir, '.credentials.json'), '{"old":true}', 'utf8');
  const fresh = { claudeAiOauth: { accessToken: 'a2', refreshToken: 'r2' } };
  seedLive(liveDir, 'A@x.com', fresh);

  assert.equal(writeBackLiveCredentials(outDir, 'a@x.com', liveDir), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, '.credentials.json'), 'utf8')), fresh);
});

test('writeBackLiveCredentials skips on email mismatch, missing email, or empty tokens', () => {
  const outDir = tempDir('cps-wb-out-');
  const liveDir = tempDir('cps-wb-live-');
  fs.writeFileSync(path.join(outDir, '.credentials.json'), '{"old":true}', 'utf8');
  const good = { claudeAiOauth: { accessToken: 'a2', refreshToken: 'r2' } };

  seedLive(liveDir, 'other@x.com', good);
  assert.equal(writeBackLiveCredentials(outDir, 'a@x.com', liveDir), false);
  assert.equal(writeBackLiveCredentials(outDir, undefined, liveDir), false);

  seedLive(liveDir, 'a@x.com', { claudeAiOauth: { accessToken: '', refreshToken: '' } });
  assert.equal(writeBackLiveCredentials(outDir, 'a@x.com', liveDir), false);

  assert.equal(fs.readFileSync(path.join(outDir, '.credentials.json'), 'utf8'), '{"old":true}');
});

test('writeBackLiveCredentials does not overwrite a newer profile copy (expiresAt guard)', () => {
  const outDir = tempDir('cps-wb-out-');
  const liveDir = tempDir('cps-wb-live-');
  const newer = { claudeAiOauth: { accessToken: 'a9', refreshToken: 'r9', expiresAt: 2000 } };
  fs.writeFileSync(path.join(outDir, '.credentials.json'), JSON.stringify(newer), 'utf8');
  seedLive(liveDir, 'a@x.com', { claudeAiOauth: { accessToken: 'a1', refreshToken: 'r1', expiresAt: 1000 } });

  assert.equal(writeBackLiveCredentials(outDir, 'a@x.com', liveDir), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, '.credentials.json'), 'utf8')), newer);

  const fresher = { claudeAiOauth: { accessToken: 'a3', refreshToken: 'r3', expiresAt: 3000 } };
  seedLive(liveDir, 'a@x.com', fresher);
  assert.equal(writeBackLiveCredentials(outDir, 'a@x.com', liveDir), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, '.credentials.json'), 'utf8')), fresher);
});
