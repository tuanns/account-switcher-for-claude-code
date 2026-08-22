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
    label: '$(window) Mở cửa sổ độc lập với profile khác...',
    detail: 'Chỉ cửa sổ này dùng profile riêng, không ảnh hưởng conversation/cửa sổ khác',
    action: { kind: 'pinMenu' },
  });
  items.push({ label: '$(add) Thêm tài khoản mới...', action: { kind: 'add' } });
  items.push({ label: '$(gear) Quản lý profile...', action: { kind: 'manage' } });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Chọn tài khoản Claude (giữ nguyên conversation hiện tại)',
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
    placeHolder: 'Cửa sổ này dùng riêng profile nào? (sẽ mở conversation mới)',
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
      label: `$(edit) Đổi tên "${p.name}"`,
      action: { kind: 'rename', profileId: p.id },
    });
    items.push({
      label: `$(trash) Xoá "${p.name}"`,
      action: { kind: 'remove', profileId: p.id },
    });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Quản lý profile',
  });
  return picked?.action;
}
