import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { getProfilesJsonPath, getUniqueProfileDirPath, getLiveDir, getSharedProjectsDir } from './paths';
import { validateNewProfileName, waitForCredentialsFile } from './addProfileLogic';
import { readOAuthAccountCache } from './migration';
import { applyEnvironmentVariableCollection } from './envCollection';
import { ensureProjectsShared } from './sharedProjects';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function isClaudeCliAvailable(): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export async function runAddProfileFlow(
  context: vscode.ExtensionContext,
  activeProfile: ClaudeProfile | undefined,
  isPinned: boolean
): Promise<ClaudeProfile | undefined> {
  if (!isClaudeCliAvailable()) {
    vscode.window.showErrorMessage(
      vscode.l10n.t(
        'Couldn\'t find the "claude" command on PATH. Install the Claude Code CLI first (npm install -g @anthropic-ai/claude-code), then try again.'
      )
    );
    return undefined;
  }

  const profilesJsonPath = getProfilesJsonPath();
  const existing = listProfiles(profilesJsonPath);

  const name = await vscode.window.showInputBox({
    prompt: vscode.l10n.t('A memorable name for the new Claude account'),
    placeHolder: 'Work',
    validateInput: (value) => validateNewProfileName(value, existing, vscode.l10n.t),
  });
  if (!name) {
    return undefined;
  }

  const dirPath = getUniqueProfileDirPath(name);
  fs.mkdirSync(dirPath, { recursive: true });
  // Junction `projects/` to the shared dir from the very start, so this
  // profile's conversation history is visible/resumable under every other
  // profile too, instead of starting its own separate history tree.
  ensureProjectsShared(dirPath, getSharedProjectsDir());

  // VSCode applies context.environmentVariableCollection to newly created
  // terminals AFTER (and overriding) the `env` option passed to
  // createTerminal below — a documented VSCode quirk, not a bug on our side:
  // https://github.com/microsoft/vscode/issues/96295. Without this, the
  // login terminal would silently inherit CLAUDE_CONFIG_DIR from whichever
  // profile is currently active instead of this new profile's directory,
  // so `claude login` would write credentials to the wrong place and our
  // wait-for-credentials-file poll below would time out even after a
  // successful login.
  context.environmentVariableCollection.replace('CLAUDE_CONFIG_DIR', dirPath);

  const terminal = vscode.window.createTerminal({
    name: `Claude Login: ${name}`,
    env: { CLAUDE_CONFIG_DIR: dirPath },
  });
  terminal.show();
  terminal.sendText('claude');

  // Restore the collection to the real active profile shortly after, so any
  // other terminal opened while the user is logging in keeps using the
  // correct account. The delay gives VSCode time to finish spawning this
  // terminal's process with the new-profile value applied above. When this
  // window isn't pinned, the "real" value is the shared `_live` dir (with
  // the active profile's identity already swapped into it), not the active
  // profile's own directory.
  setTimeout(() => {
    const restoreTarget = activeProfile
      ? { ...activeProfile, dirPath: isPinned ? activeProfile.dirPath : getLiveDir() }
      : undefined;
    applyEnvironmentVariableCollection(context, restoreTarget);
  }, 500);

  const credentialsPath = path.join(dirPath, '.credentials.json');
  // ProgressLocation.Window renders in the status bar instead of a floating
  // notification, so it never covers the login terminal (the terminal shows
  // the login URL/instructions the user needs to see and interact with).
  const loggedIn = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: vscode.l10n.t('Waiting for login for "{0}"...', name),
    },
    () => waitForCredentialsFile(credentialsPath, LOGIN_TIMEOUT_MS)
  );

  if (!loggedIn) {
    terminal.dispose();
    fs.rmSync(dirPath, { recursive: true, force: true });
    vscode.window.showWarningMessage(
      vscode.l10n.t('No successful login detected for "{0}" (over 5 minutes). Cancelled.', name)
    );
    return undefined;
  }

  const cache = readOAuthAccountCache(dirPath);
  const profile = addProfile(profilesJsonPath, {
    name,
    dirPath,
    email: cache.email,
    organizationName: cache.organizationName,
  });
  vscode.window.showInformationMessage(vscode.l10n.t('Added account "{0}".', name));
  return profile;
}
