import * as vscode from 'vscode';
import { getProfilesJsonPath } from './paths';
import { findProfile, listProfiles } from './profileStore';
import { getActiveProfileId, setActiveProfileId } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { refreshStatusBar } from './statusBar';
import { showMainMenu, showManageMenu } from './quickPick';
import { runAddProfileFlow } from './addProfileFlow';
import { runRenameFlow, runRemoveFlow } from './manageProfilesFlow';

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
  const openMenu = vscode.commands.registerCommand('claudeProfileSwitcher.openMenu', () =>
    withBusyGuard(async () => {
      const profilesJsonPath = getProfilesJsonPath();
      const profiles = listProfiles(profilesJsonPath);
      const activeId = getActiveProfileId(context);
      const result = await showMainMenu(profiles, activeId);
      if (!result) {
        return;
      }
      if (result.kind === 'switch') {
        await switchToProfile(context, statusBarItem, result.profileId);
      } else if (result.kind === 'add') {
        const created = await runAddProfileFlow();
        if (created) {
          const switchNow = await vscode.window.showInformationMessage(
            `Chuyển sang "${created.name}" ngay bây giờ?`,
            'Có',
            'Để sau'
          );
          if (switchNow === 'Có') {
            await switchToProfile(context, statusBarItem, created.id);
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
  const profiles = listProfiles(profilesJsonPath);
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
      await switchToProfile(context, statusBarItem, remaining[0]?.id);
    } else {
      refreshActiveDisplay(context, statusBarItem);
    }
  }
}

export async function switchToProfile(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  profileId: string | undefined
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = profileId ? findProfile(profilesJsonPath, profileId) : undefined;

  applyProfileEnvironment(profile);
  applyEnvironmentVariableCollection(context, profile);
  await setActiveProfileId(context, profile?.id);
  refreshStatusBar(statusBarItem, profile);

  if (profile) {
    try {
      await vscode.commands.executeCommand('claude-vscode.newConversation');
    } catch {
      // Extension chinh thuc co the doi id lenh; switch env van thanh cong.
    }
    vscode.window.showInformationMessage(
      `Đã chuyển sang "${profile.name}". Đã mở conversation mới dùng tài khoản này.`
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
