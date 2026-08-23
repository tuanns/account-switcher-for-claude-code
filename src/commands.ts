import * as vscode from 'vscode';
import { getProfilesJsonPath, getLiveDir, getSharedProjectsDir } from './paths';
import { findProfile, listProfiles } from './profileStore';
import { refreshProfilesAccountCache } from './accountCache';
import { getActiveProfileId, setActiveProfileId, getIsPinned, setIsPinned } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { refreshStatusBar } from './statusBar';
import { showMainMenu, showManageMenu, showPinMenu } from './quickPick';
import { runAddProfileFlow } from './addProfileFlow';
import { runRenameFlow, runRemoveFlow } from './manageProfilesFlow';
import { swapCredentialsIntoLive } from './liveSwap';
import { ensureProjectsShared } from './sharedProjects';

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
  const openMenu = vscode.commands.registerCommand('accountSwitcherForClaudeCode.openMenu', () =>
    withBusyGuard(async () => {
      const profilesJsonPath = getProfilesJsonPath();
      const profiles = refreshProfilesAccountCache(profilesJsonPath);
      const activeId = getActiveProfileId(context);
      const result = await showMainMenu(profiles, activeId);
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
      } else if (result.kind === 'add') {
        const activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;
        const created = await runAddProfileFlow(context, activeProfile, getIsPinned(context));
        if (created) {
          const switchNow = await vscode.window.showInformationMessage(
            vscode.l10n.t('Chuyển sang "{0}" ngay bây giờ?', created.name),
            vscode.l10n.t('Có'),
            vscode.l10n.t('Để sau')
          );
          if (switchNow === vscode.l10n.t('Có')) {
            await switchLive(context, statusBarItem, created.id);
          }
        }
      } else if (result.kind === 'manage') {
        await handleManageMenu(context, statusBarItem);
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
    const { removed } = await runRemoveFlow(result.profileId);
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
    ensureProjectsShared(liveDir, getSharedProjectsDir());
  } catch {
    // Best-effort; a later switch retries it.
  }

  await setIsPinned(context, false);
  await setActiveProfileId(context, profile?.id);
  applyProfileEnvironment(profile ? { ...profile, dirPath: liveDir } : undefined);
  applyEnvironmentVariableCollection(context, profile ? { ...profile, dirPath: liveDir } : undefined);
  refreshStatusBar(statusBarItem, profile);

  if (profile) {
    vscode.window.showInformationMessage(
      vscode.l10n.t(
        'Đã chuyển sang "{0}". Cuộc trò chuyện ĐANG MỞ vẫn dùng tài khoản cũ — mở cuộc trò chuyện mới để dùng "{0}".',
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
      ensureProjectsShared(profile.dirPath, getSharedProjectsDir());
    } catch {
      // Best-effort; a later switch retries it.
    }
  }

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
      vscode.l10n.t('Cửa sổ này dùng riêng "{0}". Đã mở conversation mới dùng tài khoản này.', profile.name)
    );
  }
}

function refreshActiveDisplay(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  const profilesJsonPath = getProfilesJsonPath();
  const activeId = getActiveProfileId(context);
  const profile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;
  refreshStatusBar(statusBarItem, profile);
}
