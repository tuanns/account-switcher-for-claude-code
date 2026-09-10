import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mergeMcpServers, syncMcpServers } from '../src/mcpServersSync';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('mergeMcpServers: local additions and overwrites win, everything else from shared is kept', () => {
  const shared = { a: { command: 'old-a' }, b: { command: 'b' } };
  const local = { a: { command: 'new-a' }, c: { command: 'c' } };
  assert.deepEqual(mergeMcpServers(shared, local), {
    a: { command: 'new-a' },
    b: { command: 'b' },
    c: { command: 'c' },
  });
});

test('syncMcpServers: a server added locally propagates into the shared registry', () => {
  const claudeJsonPath = path.join(tempDir('cps-mcp-'), '.claude.json');
  fs.writeFileSync(
    claudeJsonPath,
    JSON.stringify({ projects: {}, mcpServers: { mssql: { command: 'node', args: ['x.js'] } } }),
    'utf8'
  );
  const sharedJsonPath = path.join(tempDir('cps-mcp-shared-'), 'mcpServers.json');

  syncMcpServers(claudeJsonPath, sharedJsonPath);

  assert.deepEqual(readJson(sharedJsonPath), { mssql: { command: 'node', args: ['x.js'] } });
});

test('syncMcpServers: a server that only exists in the shared registry flows back into this profile', () => {
  const claudeJsonPath = path.join(tempDir('cps-mcp-'), '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ projects: { foo: {} } }), 'utf8');
  const sharedJsonPath = path.join(tempDir('cps-mcp-shared-'), 'mcpServers.json');
  fs.mkdirSync(path.dirname(sharedJsonPath), { recursive: true });
  fs.writeFileSync(sharedJsonPath, JSON.stringify({ 'from-another-profile': { command: 'node' } }), 'utf8');

  syncMcpServers(claudeJsonPath, sharedJsonPath);

  const updated = readJson(claudeJsonPath);
  assert.deepEqual(updated.mcpServers, { 'from-another-profile': { command: 'node' } });
  // Untouched keys survive the round-trip.
  assert.deepEqual(updated.projects, { foo: {} });
});

test('syncMcpServers: converges two profiles to the same superset over successive syncs', () => {
  const profileA = path.join(tempDir('cps-mcp-a-'), '.claude.json');
  const profileB = path.join(tempDir('cps-mcp-b-'), '.claude.json');
  const sharedJsonPath = path.join(tempDir('cps-mcp-shared-'), 'mcpServers.json');

  fs.writeFileSync(profileA, JSON.stringify({ mcpServers: { onlyA: { command: 'a' } } }), 'utf8');
  fs.writeFileSync(profileB, JSON.stringify({ mcpServers: { onlyB: { command: 'b' } } }), 'utf8');

  syncMcpServers(profileA, sharedJsonPath); // shared: {onlyA}. A: {onlyA}
  syncMcpServers(profileB, sharedJsonPath); // shared: {onlyA, onlyB}. B: {onlyA, onlyB}
  syncMcpServers(profileA, sharedJsonPath); // A picks up onlyB too

  assert.deepEqual(readJson(profileA).mcpServers, {
    onlyA: { command: 'a' },
    onlyB: { command: 'b' },
  });
  assert.deepEqual(readJson(profileB).mcpServers, {
    onlyA: { command: 'a' },
    onlyB: { command: 'b' },
  });
});

test('syncMcpServers: no-ops when the profile\'s .claude.json does not exist yet', () => {
  const claudeJsonPath = path.join(tempDir('cps-mcp-'), 'does-not-exist', '.claude.json');
  const sharedJsonPath = path.join(tempDir('cps-mcp-shared-'), 'mcpServers.json');
  fs.mkdirSync(path.dirname(sharedJsonPath), { recursive: true });
  fs.writeFileSync(sharedJsonPath, JSON.stringify({ existing: { command: 'x' } }), 'utf8');

  assert.doesNotThrow(() => syncMcpServers(claudeJsonPath, sharedJsonPath));
  assert.equal(fs.existsSync(claudeJsonPath), false);
});

test('syncMcpServers: no-ops entirely when neither side has any server yet', () => {
  const claudeJsonPath = path.join(tempDir('cps-mcp-'), '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ projects: {} }), 'utf8');
  const sharedJsonPath = path.join(tempDir('cps-mcp-shared-'), 'mcpServers.json');

  syncMcpServers(claudeJsonPath, sharedJsonPath);

  assert.equal(fs.existsSync(sharedJsonPath), false);
  assert.equal(readJson(claudeJsonPath).mcpServers, undefined);
});
