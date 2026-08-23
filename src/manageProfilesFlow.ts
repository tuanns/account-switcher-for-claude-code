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
    prompt: vscode.l10n.t('Rename "{0}" to:', profile.name),
    value: profile.name,
    validateInput: (value) => validateNewProfileName(value, others, vscode.l10n.t),
  });
  if (!newName || newName === profile.name) {
    return;
  }
  renameProfile(profilesJsonPath, profileId, newName);
  vscode.window.showInformationMessage(vscode.l10n.t('Renamed to "{0}".', newName));
}

export async function runRemoveFlow(profileId: string): Promise<{ removed: boolean }> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return { removed: false };
  }
  const removeLabel = vscode.l10n.t('Delete');
  const confirm = await vscode.window.showWarningMessage(
    vscode.l10n.t(
      'Remove profile "{0}" from the list? (Its credentials file on disk is kept, not deleted)',
      profile.name
    ),
    { modal: true },
    removeLabel
  );
  if (confirm !== removeLabel) {
    return { removed: false };
  }
  removeProfile(profilesJsonPath, profileId);
  vscode.window.showInformationMessage(vscode.l10n.t('Removed "{0}" from the list.', profile.name));
  return { removed: true };
}
