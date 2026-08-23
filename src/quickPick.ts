import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

export type MainMenuResult =
  | { kind: 'switchLive'; profileId: string }
  | { kind: 'pinMenu' }
  | { kind: 'add' }
  | { kind: 'manage' }
  | undefined;

interface MenuItem extends vscode.QuickPickItem {
  action: MainMenuResult;
}

export async function showMainMenu(
  profiles: ClaudeProfile[],
  activeProfileId: string | undefined
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
  items.push({ label: vscode.l10n.t('$(add) Add a new account...'), action: { kind: 'add' } });
  items.push({ label: vscode.l10n.t('$(gear) Manage profiles...'), action: { kind: 'manage' } });

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
