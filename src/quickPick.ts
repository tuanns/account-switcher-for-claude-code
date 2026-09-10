import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

export type MainMenuResult =
  | { kind: 'switchLive'; profileId: string }
  | { kind: 'pinMenu' }
  | { kind: 'pinWorkspaceMenu' }
  | { kind: 'unpinWorkspace' }
  | { kind: 'add' }
  | { kind: 'manage' }
  | { kind: 'openGithub' }
  | undefined;

interface MenuItem extends vscode.QuickPickItem {
  action: MainMenuResult;
}

export async function showMainMenu(
  profiles: ClaudeProfile[],
  activeProfileId: string | undefined,
  workspacePinnedProfile: ClaudeProfile | undefined
): Promise<MainMenuResult> {
  const items: MenuItem[] = profiles.map((p) => ({
    label: p.id === activeProfileId ? `$(check) ${p.name}` : p.name,
    description: p.email ?? p.dirPath,
    action: { kind: 'switchLive', profileId: p.id },
  }));
  items.push({
    label: vscode.l10n.t('$(window) Open an independent window with another profile...'),
    detail: vscode.l10n.t(
      'Only this window uses its own profile — other conversations/windows are unaffected'
    ),
    action: { kind: 'pinMenu' },
  });
  if (workspacePinnedProfile) {
    items.push({
      label: vscode.l10n.t('$(pinned) Change this workspace\'s pinned profile...'),
      detail: vscode.l10n.t(
        'Currently pinned to "{0}" — this folder ignores account switches made in other windows',
        workspacePinnedProfile.name
      ),
      action: { kind: 'pinWorkspaceMenu' },
    });
    items.push({
      label: vscode.l10n.t('$(pin) Unpin this workspace'),
      detail: vscode.l10n.t('Go back to following the app-wide account switch'),
      action: { kind: 'unpinWorkspace' },
    });
  } else {
    items.push({
      label: vscode.l10n.t('$(pin) Pin this workspace to a profile...'),
      detail: vscode.l10n.t(
        'This folder always uses the chosen profile, even when another window switches accounts'
      ),
      action: { kind: 'pinWorkspaceMenu' },
    });
  }
  items.push({ label: vscode.l10n.t('$(add) Add a new account...'), action: { kind: 'add' } });
  items.push({ label: vscode.l10n.t('$(gear) Manage profiles...'), action: { kind: 'manage' } });
  items.push({ label: vscode.l10n.t('$(github) View source on GitHub'), action: { kind: 'openGithub' } });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Choose a Claude account (keeps the current conversation)'),
  });
  return picked?.action;
}

export type PinMenuResult = { kind: 'switchPinned'; profileId: string } | undefined;

interface PinMenuItem extends vscode.QuickPickItem {
  action: PinMenuResult;
}

export async function showPinMenu(
  profiles: ClaudeProfile[],
  pinnedProfileId: string | undefined
): Promise<PinMenuResult> {
  const items: PinMenuItem[] = profiles.map((p) => ({
    label: p.id === pinnedProfileId ? `$(check) ${p.name}` : p.name,
    description: p.email ?? p.dirPath,
    action: { kind: 'switchPinned', profileId: p.id },
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Which profile should this window use exclusively? (opens a new conversation)'),
  });
  return picked?.action;
}

export type WorkspacePinMenuResult = { kind: 'switchWorkspacePinned'; profileId: string } | undefined;

interface WorkspacePinMenuItem extends vscode.QuickPickItem {
  action: WorkspacePinMenuResult;
}

export async function showWorkspacePinMenu(
  profiles: ClaudeProfile[],
  workspacePinnedProfileId: string | undefined
): Promise<WorkspacePinMenuResult> {
  const items: WorkspacePinMenuItem[] = profiles.map((p) => ({
    label: p.id === workspacePinnedProfileId ? `$(check) ${p.name}` : p.name,
    description: p.email ?? p.dirPath,
    action: { kind: 'switchWorkspacePinned', profileId: p.id },
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t(
      'Which profile should THIS WORKSPACE always use? (opens a new conversation)'
    ),
  });
  return picked?.action;
}

export type ManageMenuResult =
  | { kind: 'rename'; profileId: string }
  | { kind: 'remove'; profileId: string }
  | undefined;

interface ManageMenuItem extends vscode.QuickPickItem {
  action: ManageMenuResult;
}

export async function showManageMenu(profiles: ClaudeProfile[]): Promise<ManageMenuResult> {
  const items: ManageMenuItem[] = [];
  for (const p of profiles) {
    items.push({
      label: vscode.l10n.t('$(edit) Rename "{0}"', p.name),
      action: { kind: 'rename', profileId: p.id },
    });
    items.push({
      label: vscode.l10n.t('$(trash) Delete "{0}"', p.name),
      action: { kind: 'remove', profileId: p.id },
    });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Manage profiles'),
  });
  return picked?.action;
}
