import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

export type MainMenuResult =
  | { kind: 'switch'; profileId: string }
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
    action: { kind: 'switch', profileId: p.id },
  }));
  items.push({ label: '$(add) Them tai khoan moi...', action: { kind: 'add' } });
  items.push({ label: '$(gear) Quan ly profile...', action: { kind: 'manage' } });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Chon tai khoan Claude',
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
      label: `$(edit) Doi ten "${p.name}"`,
      action: { kind: 'rename', profileId: p.id },
    });
    items.push({
      label: `$(trash) Xoa "${p.name}"`,
      action: { kind: 'remove', profileId: p.id },
    });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Quan ly profile',
  });
  return picked?.action;
}
