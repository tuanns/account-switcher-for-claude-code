import * as vscode from 'vscode';
import { findProfile, removeProfile, renameProfile, listProfiles } from './profileStore';
import { getProfilesJsonPath } from './paths';
import { validateNewProfileName } from './addProfileLogic';

export async function runRenameFlow(profileId: string): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return;
  }
  const others = listProfiles(profilesJsonPath).filter((p) => p.id !== profileId);
  const newName = await vscode.window.showInputBox({
    prompt: `Đổi tên "${profile.name}" thành:`,
    value: profile.name,
    validateInput: (value) => validateNewProfileName(value, others),
  });
  if (!newName || newName === profile.name) {
    return;
  }
  renameProfile(profilesJsonPath, profileId, newName);
  vscode.window.showInformationMessage(`Đã đổi tên thành "${newName}".`);
}

export async function runRemoveFlow(profileId: string): Promise<{ removed: boolean }> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return { removed: false };
  }
  const confirm = await vscode.window.showWarningMessage(
    `Xoá profile "${profile.name}" khỏi danh sách? (File credentials trên đĩa sẽ được giữ lại, không bị xoá)`,
    { modal: true },
    'Xoá'
  );
  if (confirm !== 'Xoá') {
    return { removed: false };
  }
  removeProfile(profilesJsonPath, profileId);
  vscode.window.showInformationMessage(`Đã xoá "${profile.name}" khỏi danh sách.`);
  return { removed: true };
}
