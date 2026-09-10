import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveEffectiveProfile } from '../src/effectiveProfile';
import type { ClaudeProfile } from '../src/profileStore';

function profile(id: string, dirPath: string): ClaudeProfile {
  return { id, name: id, dirPath, createdAt: new Date().toISOString() };
}

const LIVE_DIR = '/home/user/.claude-profiles/_live';

function profileLookup(...profiles: ClaudeProfile[]): (id: string) => ClaudeProfile | undefined {
  return (id) => profiles.find((p) => p.id === id);
}

test('resolveEffectiveProfile: workspace pin wins over global state', () => {
  const workDir = '/home/user/.claude-profiles/work';
  const defaultDir = '/home/user/.claude';
  const work = profile('work', workDir);
  const dflt = profile('default', defaultDir);

  const result = resolveEffectiveProfile({
    workspacePinnedId: 'work',
    activeId: 'default',
    isPinned: false,
    liveDir: LIVE_DIR,
    findProfile: profileLookup(work, dflt),
  });

  assert.equal(result.source, 'workspace');
  assert.equal(result.profile?.id, 'work');
  // Own directory, never the shared `_live` dir — immune to switches made
  // in other windows.
  assert.equal(result.dirPath, workDir);
});

test('resolveEffectiveProfile: falls back to global-live when no workspace pin', () => {
  const dflt = profile('default', '/home/user/.claude');
  const result = resolveEffectiveProfile({
    workspacePinnedId: undefined,
    activeId: 'default',
    isPinned: false,
    liveDir: LIVE_DIR,
    findProfile: profileLookup(dflt),
  });

  assert.equal(result.source, 'global-live');
  assert.equal(result.profile?.id, 'default');
  assert.equal(result.dirPath, LIVE_DIR);
});

test('resolveEffectiveProfile: falls back to global-pinned (own dir) when globally pinned', () => {
  const dflt = profile('default', '/home/user/.claude');
  const result = resolveEffectiveProfile({
    workspacePinnedId: undefined,
    activeId: 'default',
    isPinned: true,
    liveDir: LIVE_DIR,
    findProfile: profileLookup(dflt),
  });

  assert.equal(result.source, 'global-pinned');
  assert.equal(result.dirPath, '/home/user/.claude');
});

test('resolveEffectiveProfile: a workspace pin naming a deleted profile falls through to global state', () => {
  const dflt = profile('default', '/home/user/.claude');
  const result = resolveEffectiveProfile({
    workspacePinnedId: 'deleted-profile-id',
    activeId: 'default',
    isPinned: false,
    liveDir: LIVE_DIR,
    findProfile: profileLookup(dflt), // 'deleted-profile-id' intentionally absent
  });

  assert.equal(result.source, 'global-live');
  assert.equal(result.profile?.id, 'default');
});

test('resolveEffectiveProfile: nothing active anywhere resolves to none', () => {
  const result = resolveEffectiveProfile({
    workspacePinnedId: undefined,
    activeId: undefined,
    isPinned: false,
    liveDir: LIVE_DIR,
    findProfile: () => undefined,
  });

  assert.equal(result.source, 'none');
  assert.equal(result.profile, undefined);
  assert.equal(result.dirPath, undefined);
});

test('resolveEffectiveProfile: a stale global activeId that no longer exists resolves to none', () => {
  const result = resolveEffectiveProfile({
    workspacePinnedId: undefined,
    activeId: 'ghost',
    isPinned: false,
    liveDir: LIVE_DIR,
    findProfile: () => undefined,
  });

  assert.equal(result.source, 'none');
});
