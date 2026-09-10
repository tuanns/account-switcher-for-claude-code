import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderStatusBarText } from '../src/statusBarText';
import type { ClaudeProfile } from '../src/profileStore';

test('renderStatusBarText shows placeholder when no active profile', () => {
  assert.equal(renderStatusBarText(undefined), '$(account) Claude: (none)');
});

test('renderStatusBarText shows the active profile name', () => {
  const profile: ClaudeProfile = {
    id: '1',
    name: 'Work',
    dirPath: 'C:\\fake\\work',
    createdAt: new Date().toISOString(),
  };
  assert.equal(renderStatusBarText(profile), '$(account) Claude: Work');
});

test('renderStatusBarText marks a workspace-pinned profile distinctly', () => {
  const profile: ClaudeProfile = {
    id: '1',
    name: 'Work',
    dirPath: 'C:\\fake\\work',
    createdAt: new Date().toISOString(),
  };
  assert.equal(
    renderStatusBarText(profile, true),
    '$(pinned) Claude: Work (this workspace)'
  );
});

test('renderStatusBarText ignores the workspace-pinned flag when there is no active profile', () => {
  assert.equal(renderStatusBarText(undefined, true), '$(account) Claude: (none)');
});
