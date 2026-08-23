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
    label: vscode.l10n.t('$(window) Mở cửa sổ độc lập với profile khác...'),
    detail: vscode.l10n.t(
      'Chỉ cửa sổ này dùng profile riêng, không ảnh hưởng conversation/cửa sổ khác'
    ),
    action: { kind: 'pinMenu' },
  });
  items.push({ label: vscode.l10n.t('$(add) Thêm tài khoản mới...'), action: { kind: 'add' } });
  items.push({ label: vscode.l10n.t('$(gear) Quản lý profile...'), action: { kind: 'manage' } });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Chọn tài khoản Claude (giữ nguyên conversation hiện tại)'),
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
    placeHolder: vscode.l10n.t('Cửa sổ này dùng riêng profile nào? (sẽ mở conversation mới)'),
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
      label: vscode.l10n.t('$(edit) Đổi tên "{0}"', p.name),
      action: { kind: 'rename', profileId: p.id },
    });
    items.push({
      label: vscode.l10n.t('$(trash) Xoá "{0}"', p.name),
      action: { kind: 'remove', profileId: p.id },
    });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t('Quản lý profile'),
  });
  return picked?.action;
}
