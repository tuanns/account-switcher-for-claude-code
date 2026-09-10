import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { ensureAllDirsShared } from './sharedDirs';

export function getDefaultClaudeDir(): string {
  return path.join(os.homedir(), '.claude');
}

export function hasExistingLogin(claudeDir: string): boolean {
  return fs.existsSync(path.join(claudeDir, '.credentials.json'));
}

interface OAuthAccountCache {
  email?: string;
  organizationName?: string;
}

export function readOAuthAccountCache(claudeDir: string): OAuthAccountCache {
  const configPath = path.join(claudeDir, '.claude.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const account = parsed?.oauthAccount ?? {};
    return {
      email: typeof account.emailAddress === 'string' ? account.emailAddress : undefined,
      organizationName:
        typeof account.organizationName === 'string' ? account.organizationName : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Claude Code CLI's pre-`CLAUDE_CONFIG_DIR`-era convention keeps the
 * user-level JSON config (`mcpServers`, the `projects` map, `oauthAccount`,
 * ...) at `~/.claude.json` — a *sibling* of `~/.claude/`, not nested inside
 * it. Every profile this extension creates itself keeps its own copy of
 * that file at `<dirPath>/.claude.json` (matching how `CLAUDE_CONFIG_DIR`
 * relocates things once it's actually set), but the one profile whose
 * directory PRE-DATES this extension (the real `~/.claude`) never had a
 * `.claude.json` at that nested path — its real one has always been the
 * sibling file.
 *
 * Without this, first-run migration silently lost the user's pre-existing
 * `mcpServers`/project settings: `<claudeDir>/.claude.json` never existed,
 * so `readOAuthAccountCache` below and `extension.ts`'s post-migration
 * `swapCredentialsIntoLive` call both just found nothing there to read from
 * — no error, just quietly missing data, discovered only much later as
 * "my MCP servers disappeared."
 */
function seedLegacyConfigFileIfMissing(claudeDir: string, legacyConfigPath: string): void {
  const nestedPath = path.join(claudeDir, '.claude.json');
  if (fs.existsSync(nestedPath) || !fs.existsSync(legacyConfigPath)) {
    return;
  }
  fs.copyFileSync(legacyConfigPath, nestedPath);
}

export function tryFirstRunMigration(
  profilesJsonPath: string,
  claudeDir: string = getDefaultClaudeDir(),
  // Forwarded to ensureAllDirsShared as-is; overridden by tests so they
  // exercise a temp dir instead of the real ~/.claude-profiles/_shared on
  // whatever machine runs them.
  sharedDirFor?: (name: string) => string,
  // The sibling `~/.claude.json` candidate for seedLegacyConfigFileIfMissing
  // above; overridden by tests with an isolated temp path instead of the
  // real `os.homedir()` on whatever machine runs them.
  legacyConfigPath: string = path.join(os.homedir(), '.claude.json')
): ClaudeProfile | undefined {
  if (listProfiles(profilesJsonPath).length > 0) {
    return undefined;
  }
  if (!hasExistingLogin(claudeDir)) {
    return undefined;
  }

  seedLegacyConfigFileIfMissing(claudeDir, legacyConfigPath);

  const cache = readOAuthAccountCache(claudeDir);
  const migrated = addProfile(profilesJsonPath, {
    name: 'Default',
    dirPath: claudeDir,
    email: cache.email,
    organizationName: cache.organizationName,
  });

  // Without this, extension.ts's own post-migration ensureAllDirsShared call
  // runs against the (still-empty) `_live` dir in the default/unpinned mode,
  // never against `claudeDir` itself — so whatever session history/plugins/
  // skills already existed under the user's pre-existing `~/.claude` (from
  // before this extension was ever installed) stayed orphaned there,
  // invisible from every profile including "Default" itself until the user
  // happened to pin to it at least once (switchPinned does call this
  // correctly, on the profile's own dirPath).
  try {
    ensureAllDirsShared(claudeDir, sharedDirFor);
  } catch {
    // Best-effort; a later switch (pinned or not) retries it regardless.
  }

  return migrated;
}
