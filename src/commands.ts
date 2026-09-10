import * as vscode from 'vscode';
import { getProfilesJsonPath, getLiveDir } from './paths';
import { findProfile, listProfiles } from './profileStore';
import { refreshProfilesAccountCache } from './accountCache';
import { getActiveProfileId, setActiveProfileId, getIsPinned, setIsPinned } from './activeProfileState';
import { getWorkspacePinnedProfileId, setWorkspacePinnedProfileId } from './workspacePin';
import { resolveEffectiveProfile } from './effectiveProfile';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { refreshStatusBar } from './statusBar';
import { showMainMenu, showManageMenu, showPinMenu, showWorkspacePinMenu } from './quickPick';
import { runAddProfileFlow } from './addProfileFlow';
import { runRenameFlow, runRemoveFlow } from './manageProfilesFlow';
import { swapCredentialsIntoLive } from './liveSwap';
import { ensureAllDirsShared } from './sharedDirs';
import { isCredentialsWiped } from './credentialsHealth';
import { runReLoginFlow } from './reLoginFlow';

let isBusy = false;

async function withBusyGuard(fn: () => Promise<void>): Promise<void> {
  if (isBusy) {
    return;
  }
  isBusy = true;
  try {
    await fn();
  } finally {
    isBusy = false;
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  const openMenu = vscode.commands.registerCommand('profileSwitcherForClaudeCode.openMenu', () =>
    withBusyGuard(async () => {
      const profilesJsonPath = getProfilesJsonPath();
      const profiles = refreshProfilesAccountCache(profilesJsonPath);
      const activeId = getActiveProfileId(context);

      // Proactively surface a wiped-token profile (see credentialsHealth.ts)
      // instead of letting the user discover it mid-conversation as a
      // confusing auth error. Checked on every menu open since it's just a
      // few cheap file reads; only the first wiped profile found is
      // reported — a later one gets caught the next time the menu opens.
      //
      // IMPORTANT: this must NOT block the switch menu below. A wiped
      // profile is just ONE profile being broken — the user should still
      // be able to switch to any other, working profile right away instead
      // of being stuck behind a warning about a profile they may not even
      // want to use right now. Only re-logging in (which takes over the UI
      // itself) skips straight to done instead of also opening the menu.
      const wiped = profiles.find((p) => isCredentialsWiped(p.dirPath));
      if (wiped) {
        const reLoginLabel = vscode.l10n.t('Log in again');
        const choice = await vscode.window.showWarningMessage(
          vscode.l10n.t(
            '"{0}"\'s login session was lost (its token got cleared) — log in again to keep using it.',
            wiped.name
          ),
          reLoginLabel
        );
        if (choice === reLoginLabel) {
          const activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;
          await runReLoginFlow(context, wiped, activeProfile, getIsPinned(context));
          return;
        }
      }

      const workspacePinnedId = getWorkspacePinnedProfileId(context);
      const workspacePinnedProfile = workspacePinnedId
        ? findProfile(profilesJsonPath, workspacePinnedId)
        : undefined;

      const result = await showMainMenu(profiles, activeId, workspacePinnedProfile);
      if (!result) {
        return;
      }
      if (result.kind === 'switchLive') {
        await switchLive(context, statusBarItem, result.profileId);
      } else if (result.kind === 'pinMenu') {
        const pinResult = await showPinMenu(profiles, getIsPinned(context) ? activeId : undefined);
        if (pinResult) {
          await switchPinned(context, statusBarItem, pinResult.profileId);
        }
      } else if (result.kind === 'pinWorkspaceMenu') {
        const pinResult = await showWorkspacePinMenu(profiles, workspacePinnedId);
        if (pinResult) {
          await switchWorkspacePinned(context, statusBarItem, pinResult.profileId);
        }
      } else if (result.kind === 'unpinWorkspace') {
        await unpinWorkspace(context, statusBarItem);
      } else if (result.kind === 'add') {
        const activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;
        const created = await runAddProfileFlow(context, activeProfile, getIsPinned(context));
        if (created) {
          const switchNow = await vscode.window.showInformationMessage(
            vscode.l10n.t('Switch to "{0}" now?', created.name),
            vscode.l10n.t('Yes'),
            vscode.l10n.t('Later')
          );
          if (switchNow === vscode.l10n.t('Yes')) {
            await switchLive(context, statusBarItem, created.id);
          }
        }
      } else if (result.kind === 'manage') {
        await handleManageMenu(context, statusBarItem);
      } else if (result.kind === 'openGithub') {
        const url = getRepositoryUrl(context);
        if (url) {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
      }
    })
  );

  context.subscriptions.push(openMenu);
}

async function handleManageMenu(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profiles = refreshProfilesAccountCache(profilesJsonPath);
  const result = await showManageMenu(profiles);
  if (!result) {
    return;
  }
  if (result.kind === 'rename') {
    await runRenameFlow(result.profileId);
    refreshActiveDisplay(context, statusBarItem);
  } else if (result.kind === 'remove') {
    const activeId = getActiveProfileId(context);
    const workspacePinnedId = getWorkspacePinnedProfileId(context);
    const { removed } = await runRemoveFlow(result.profileId);
    if (removed && result.profileId === workspacePinnedId) {
      // Don't leave this workspace pinned to a profile that no longer
      // exists — `resolveEffectiveProfile` would already fall back
      // gracefully, but clearing it here keeps the stored state honest and
      // the menu's "pinned to X" label from ever naming a dead profile.
      await setWorkspacePinnedProfileId(context, undefined);
    }
    if (removed && result.profileId === activeId) {
      const remaining = listProfiles(profilesJsonPath);
      await switchLive(context, statusBarItem, remaining[0]?.id);
    } else {
      refreshActiveDisplay(context, statusBarItem);
    }
  }
}

/**
 * "Giữ conversation" switch: overwrites the shared `_live` directory's
 * credentials with the chosen profile's, so any *new* conversation started
 * in a window pointed at `_live` (i.e. not pinned to its own directory) uses
 * the new account.
 *
 * IMPORTANT (verified 2026-08-23): this does NOT retroactively affect a
 * conversation already open at the time of the switch. The `claude`
 * subprocess backing an open conversation is spawned once and keeps
 * whatever `CLAUDE_CONFIG_DIR` it read at spawn time for its whole
 * lifetime — rewriting `_live` on disk afterwards has no effect on it.
 * Only the *next* conversation opened in this (or any other unpinned)
 * window actually picks up the new account. Does NOT trigger a
 * new-conversation command itself — the currently open one is left alone
 * on purpose, in case the user wants to keep working in it under the old
 * account while future conversations use the new one.
 *
 * If this workspace has its own pin (see `switchWorkspacePinned`), invoking
 * the plain switch menu from here is treated as the user opting this
 * workspace back into the app-wide behavior, so the pin is cleared —
 * otherwise the workspace pin would silently keep winning on next reload,
 * contradicting the switch the user just made right now.
 */
export async function switchLive(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  profileId: string | undefined
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = profileId ? findProfile(profilesJsonPath, profileId) : undefined;
  const liveDir = getLiveDir();

  if (profile) {
    swapCredentialsIntoLive(profile.dirPath, liveDir);
  }
  try {
    ensureAllDirsShared(liveDir);
  } catch {
    // Best-effort; a later switch retries it.
  }

  await setWorkspacePinnedProfileId(context, undefined);
  await setIsPinned(context, false);
  await setActiveProfileId(context, profile?.id);
  applyProfileEnvironment(profile ? { ...profile, dirPath: liveDir } : undefined);
  applyEnvironmentVariableCollection(context, profile ? { ...profile, dirPath: liveDir } : undefined);
  refreshStatusBar(statusBarItem, profile);

  if (profile) {
    vscode.window.showInformationMessage(
      vscode.l10n.t(
        'Switched to "{0}". The conversation that\'s currently OPEN still uses the old account — open a new conversation to use "{0}".',
        profile.name
      )
    );
  }
}

/**
 * "Cửa sổ độc lập" switch: points THIS window's own directory directly at
 * the chosen profile's own directory (the original per-window isolation
 * mechanism), so other windows/`_live` are unaffected. Since this is a
 * genuinely different directory, a running conversation can't pick it up in
 * place, so a new conversation is opened.
 *
 * Also clears any workspace pin for the same reason `switchLive` does — see
 * its doc comment.
 */
export async function switchPinned(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  profileId: string | undefined
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = profileId ? findProfile(profilesJsonPath, profileId) : undefined;

  if (profile) {
    try {
      ensureAllDirsShared(profile.dirPath);
    } catch {
      // Best-effort; a later switch retries it.
    }
  }

  await setWorkspacePinnedProfileId(context, undefined);
  await setIsPinned(context, true);
  await setActiveProfileId(context, profile?.id);
  applyProfileEnvironment(profile);
  applyEnvironmentVariableCollection(context, profile);
  refreshStatusBar(statusBarItem, profile);

  if (profile) {
    try {
      await vscode.commands.executeCommand('claude-vscode.newConversation');
    } catch {
      // Extension chinh thuc co the doi id lenh; switch env van thanh cong.
    }
    vscode.window.showInformationMessage(
      vscode.l10n.t('This window now uses "{0}" exclusively. Opened a new conversation using this account.', profile.name)
    );
  }
}

/**
 * Pins THIS WORKSPACE (folder) to a specific profile, stored in
 * `context.workspaceState` — unlike `switchPinned` above (which is
 * per-window but still backed by shared `globalState`, see
 * `activeProfileState.ts`), this survives and stays isolated across every
 * other window and every other switch made anywhere else: reopening this
 * exact folder always resolves back to the pinned profile's own directory,
 * regardless of what any other window's `activeProfileId`/`_live` currently
 * point at (see `effectiveProfile.ts`).
 */
export async function switchWorkspacePinned(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  profileId: string | undefined
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = profileId ? findProfile(profilesJsonPath, profileId) : undefined;
  if (!profile) {
    return;
  }

  try {
    ensureAllDirsShared(profile.dirPath);
  } catch {
    // Best-effort; a later switch retries it.
  }

  await setWorkspacePinnedProfileId(context, profile.id);
  applyProfileEnvironment(profile);
  applyEnvironmentVariableCollection(context, profile);
  refreshStatusBar(statusBarItem, profile, true);

  try {
    await vscode.commands.executeCommand('claude-vscode.newConversation');
  } catch {
    // Extension chinh thuc co the doi id lenh; switch env van thanh cong.
  }
  vscode.window.showInformationMessage(
    vscode.l10n.t(
      'This workspace is now pinned to "{0}" — switching accounts in any other window will never affect it. Opened a new conversation using this account.',
      profile.name
    )
  );
}

/**
 * Clears this workspace's pin and falls back to whatever the app-wide
 * switch (`activeProfileId`/`isPinnedToOwnDir`) currently resolves to.
 */
export async function unpinWorkspace(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  await setWorkspacePinnedProfileId(context, undefined);

  const profilesJsonPath = getProfilesJsonPath();
  const activeId = getActiveProfileId(context);
  const resolved = resolveEffectiveProfile({
    workspacePinnedId: undefined,
    activeId,
    isPinned: getIsPinned(context),
    liveDir: getLiveDir(),
    findProfile: (id) => findProfile(profilesJsonPath, id),
  });
  const effectiveProfile =
    resolved.profile && resolved.dirPath ? { ...resolved.profile, dirPath: resolved.dirPath } : undefined;

  applyProfileEnvironment(effectiveProfile);
  applyEnvironmentVariableCollection(context, effectiveProfile);
  refreshStatusBar(statusBarItem, resolved.profile, false);

  if (effectiveProfile) {
    try {
      await vscode.commands.executeCommand('claude-vscode.newConversation');
    } catch {
      // Extension chinh thuc co the doi id lenh; switch env van thanh cong.
    }
  }
  vscode.window.showInformationMessage(
    vscode.l10n.t('This workspace no longer has its own pinned profile — it now follows the app-wide switch.')
  );
}

/**
 * Reads `repository.url` straight from this extension's own manifest
 * (rather than hardcoding the GitHub URL a second time in source) and
 * normalizes it into something a browser can open: strips the `git+`
 * prefix and trailing `.git` that npm's `repository` field convention
 * uses but a plain HTTPS link doesn't need.
 */
function getRepositoryUrl(context: vscode.ExtensionContext): string | undefined {
  const raw = context.extension.packageJSON?.repository?.url as string | undefined;
  if (!raw) {
    return undefined;
  }
  return raw.replace(/^git\+/, '').replace(/\.git$/, '');
}

function refreshActiveDisplay(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  const profilesJsonPath = getProfilesJsonPath();
  const activeId = getActiveProfileId(context);
  const resolved = resolveEffectiveProfile({
    workspacePinnedId: getWorkspacePinnedProfileId(context),
    activeId,
    isPinned: getIsPinned(context),
    liveDir: getLiveDir(),
    findProfile: (id) => findProfile(profilesJsonPath, id),
  });
  refreshStatusBar(statusBarItem, resolved.profile, resolved.source === 'workspace');
}
