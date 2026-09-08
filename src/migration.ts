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

export function tryFirstRunMigration(
  profilesJsonPath: string,
  claudeDir: string = getDefaultClaudeDir(),
  // Forwarded to ensureAllDirsShared as-is; overridden by tests so they
  // exercise a temp dir instead of the real ~/.claude-profiles/_shared on
  // whatever machine runs them.
  sharedDirFor?: (name: string) => string
): ClaudeProfile | undefined {
  if (listProfiles(profilesJsonPath).length > 0) {
    return undefined;
  }
  if (!hasExistingLogin(claudeDir)) {
    return undefined;
  }
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
