import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyProfileEnvironment } from '../src/envApply';
import type { ClaudeProfile } from '../src/profileStore';

test('applyProfileEnvironment sets CLAUDE_CONFIG_DIR from the given profile', () => {
  const before = process.env.CLAUDE_CONFIG_DIR;
  try {
    const profile: ClaudeProfile = {
      id: '1',
      name: 'Work',
      dirPath: 'C:\\fake\\work',
      createdAt: new Date().toISOString(),
    };
    applyProfileEnvironment(profile);
    assert.equal(process.env.CLAUDE_CONFIG_DIR, 'C:\\fake\\work');
  } finally {
    if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = before;
  }
});

test('applyProfileEnvironment clears CLAUDE_CONFIG_DIR when given undefined', () => {
  const before = process.env.CLAUDE_CONFIG_DIR;
  try {
    process.env.CLAUDE_CONFIG_DIR = 'C:\\fake\\stale';
    applyProfileEnvironment(undefined);
    assert.equal(process.env.CLAUDE_CONFIG_DIR, undefined);
  } finally {
    if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = before;
  }
});
