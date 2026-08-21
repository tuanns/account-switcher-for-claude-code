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
    prompt: `Doi ten "${profile.name}" thanh:`,
    value: profile.name,
    validateInput: (value) => validateNewProfileName(value, others),
  });
  if (!newName || newName === profile.name) {
    return;
  }
  renameProfile(profilesJsonPath, profileId, newName);
  vscode.window.showInformationMessage(`Da doi ten thanh "${newName}".`);
}

export async function runRemoveFlow(profileId: string): Promise<{ removed: boolean }> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return { removed: false };
  }
  const confirm = await vscode.window.showWarningMessage(
    `Xoa profile "${profile.name}" khoi danh sach? (File credentials tren dia se duoc giu lai, khong bi xoa)`,
    { modal: true },
    'Xoa'
  );
  if (confirm !== 'Xoa') {
    return { removed: false };
  }
  removeProfile(profilesJsonPath, profileId);
  vscode.window.showInformationMessage(`Da xoa "${profile.name}" khoi danh sach.`);
  return { removed: true };
}
