import { readProfilesFile, writeProfilesFile } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { readOAuthAccountCache } from './migration';

/**
 * Refreshes each profile's cached `email`/`organizationName` (shown in the
 * switch menus, see `quickPick.ts`) from its own `dirPath`'s live
 * `.claude.json`. The cache is otherwise only ever captured once, at
 * profile-creation time — it can start out empty (e.g. first-run migration
 * importing `~/.claude` before `oauthAccount` had been populated there yet)
 * or go stale (re-login into the same profile dir under a different
 * account), and nothing else ever writes it again.
 *
 * Best-effort and non-destructive: a profile whose `dirPath` currently has
 * no readable `oauthAccount` keeps its previously cached value instead of
 * being cleared.
 */
export function refreshProfilesAccountCache(profilesJsonPath: string): ClaudeProfile[] {
  const data = readProfilesFile(profilesJsonPath);
  let changed = false;

  for (const profile of data.profiles) {
    const cache = readOAuthAccountCache(profile.dirPath);
    if (cache.email !== undefined && cache.email !== profile.email) {
      profile.email = cache.email;
      changed = true;
    }
    if (cache.organizationName !== undefined && cache.organizationName !== profile.organizationName) {
      profile.organizationName = cache.organizationName;
      changed = true;
    }
  }

  if (changed) {
    writeProfilesFile(profilesJsonPath, data);
  }
  return data.profiles;
}
