import * as vscode from 'vscode';
import * as path from 'path';
import { waitForCredentialsFile } from './addProfileLogic';
import { applyEnvironmentVariableCollection } from './envCollection';
import { getLiveDir } from './paths';
import type { ClaudeProfile } from './profileStore';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Opens a terminal running `claude` with `CLAUDE_CONFIG_DIR` pinned to
 * `dirPath`, waits (with a window-progress indicator) for a
 * `.credentials.json` to appear there, and restores this window's real
 * `environmentVariableCollection` value shortly after the terminal spawns.
 *
 * Shared by both "add a new account" (`addProfileFlow.ts`, a brand-new
 * `dirPath`) and "re-login an existing profile whose token got wiped"
 * (`reLoginFlow.ts`, an existing `dirPath`) — the two only differ in what
 * they do with the `profiles.json` entry afterward, and in cleanup on
 * timeout (a fresh dir gets deleted; an existing profile's dir is left
 * alone).
 */
export async function openLoginTerminalAndWaitForCredentials(
  context: vscode.ExtensionContext,
  dirPath: string,
  label: string,
  restoreTarget: { activeProfile: ClaudeProfile | undefined; isPinned: boolean }
): Promise<{ loggedIn: boolean; terminal: vscode.Terminal }> {
  // VSCode applies context.environmentVariableCollection to newly created
  // terminals AFTER (and overriding) the `env` option passed to
  // createTerminal below — a documented VSCode quirk, not a bug on our side:
  // https://github.com/microsoft/vscode/issues/96295. Without this, the
  // login terminal would silently inherit CLAUDE_CONFIG_DIR from whichever
  // profile is currently active instead of this one, so `claude` would
  // write credentials to the wrong place and the wait below would time out
  // even after a successful login.
  context.environmentVariableCollection.replace('CLAUDE_CONFIG_DIR', dirPath);

  const terminal = vscode.window.createTerminal({
    name: vscode.l10n.t('Claude Login: {0}', label),
    env: { CLAUDE_CONFIG_DIR: dirPath },
  });
  terminal.show();
  terminal.sendText('claude');

  // Restore the collection to the real active profile shortly after, so any
  // other terminal opened while the user is logging in keeps using the
  // correct account. The delay gives VSCode time to finish spawning this
  // terminal's process with the login-dir value applied above.
  setTimeout(() => {
    const target = restoreTarget.activeProfile
      ? {
          ...restoreTarget.activeProfile,
          dirPath: restoreTarget.isPinned ? restoreTarget.activeProfile.dirPath : getLiveDir(),
        }
      : undefined;
    applyEnvironmentVariableCollection(context, target);
  }, 500);

  const credentialsPath = path.join(dirPath, '.credentials.json');
  // ProgressLocation.Window renders in the status bar instead of a floating
  // notification, so it never covers the login terminal (the terminal shows
  // the login URL/instructions the user needs to see and interact with).
  const loggedIn = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: vscode.l10n.t('Waiting for login for "{0}"...', label),
    },
    () => waitForCredentialsFile(credentialsPath, LOGIN_TIMEOUT_MS)
  );

  return { loggedIn, terminal };
}
