import * as vscode from 'vscode';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { getProfilesJsonPath, getUniqueProfileDirPath, getSharedProjectsDir } from './paths';
import { validateNewProfileName } from './addProfileLogic';
import { readOAuthAccountCache } from './migration';
import { ensureProjectsShared } from './sharedProjects';
import { openLoginTerminalAndWaitForCredentials } from './loginTerminal';

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

  const { loggedIn, terminal } = await openLoginTerminalAndWaitForCredentials(context, dirPath, name, {
    activeProfile,
    isPinned,
  });

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
