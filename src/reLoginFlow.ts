import * as vscode from 'vscode';
import { readOAuthAccountCache } from './migration';
import { getProfilesJsonPath } from './paths';
import { writeProfilesFile, readProfilesFile } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { openLoginTerminalAndWaitForCredentials } from './loginTerminal';

/**
 * Re-runs the OAuth login for an *existing* profile whose `.credentials.json`
 * got wiped (see `credentialsHealth.ts`), in place — same `dirPath`, same
 * `profiles.json` entry, just fresh tokens. Unlike `runAddProfileFlow`, on
 * timeout/cancel nothing is deleted (the profile already existed before this
 * ran and keeps existing, still logged out).
 */
export async function runReLoginFlow(
  context: vscode.ExtensionContext,
  profile: ClaudeProfile,
  activeProfile: ClaudeProfile | undefined,
  isPinned: boolean
): Promise<boolean> {
  const { loggedIn, terminal } = await openLoginTerminalAndWaitForCredentials(
    context,
    profile.dirPath,
    profile.name,
    { activeProfile, isPinned }
  );

  if (!loggedIn) {
    terminal.dispose();
    vscode.window.showWarningMessage(
      vscode.l10n.t('No successful login detected for "{0}" (over 5 minutes). Cancelled.', profile.name)
    );
    return false;
  }

  const profilesJsonPath = getProfilesJsonPath();
  const data = readProfilesFile(profilesJsonPath);
  const cache = readOAuthAccountCache(profile.dirPath);
  const entry = data.profiles.find((p) => p.id === profile.id);
  if (entry) {
    if (cache.email !== undefined) {
      entry.email = cache.email;
    }
    if (cache.organizationName !== undefined) {
      entry.organizationName = cache.organizationName;
    }
    writeProfilesFile(profilesJsonPath, data);
  }

  vscode.window.showInformationMessage(vscode.l10n.t('Logged in again for "{0}".', profile.name));
  return true;
}
