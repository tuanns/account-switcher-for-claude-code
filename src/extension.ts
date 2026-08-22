import * as vscode from 'vscode';
import { getProfilesJsonPath, getLiveDir } from './paths';
import { findProfile } from './profileStore';
import { tryFirstRunMigration } from './migration';
import { getActiveProfileId, setActiveProfileId, getIsPinned } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { createStatusBarItem, refreshStatusBar } from './statusBar';
import { registerCommands } from './commands';
import { swapCredentialsIntoLive } from './liveSwap';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();

  const activeId = getActiveProfileId(context);
  let activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;

  if (!activeProfile) {
    const migrated = tryFirstRunMigration(profilesJsonPath);
    if (migrated) {
      await setActiveProfileId(context, migrated.id);
      activeProfile = migrated;
      // Seed the shared `_live` dir from the migrated profile once, so the
      // default (unpinned) "giữ conversation" switch mode works from the
      // very first activation without requiring an explicit switch first.
      try {
        swapCredentialsIntoLive(migrated.dirPath, getLiveDir());
      } catch {
        // Best-effort seeding only; a later explicit switch will retry it.
      }
    }
  }

  const isPinned = getIsPinned(context);
  const effectiveProfile = activeProfile
    ? { ...activeProfile, dirPath: isPinned ? activeProfile.dirPath : getLiveDir() }
    : undefined;

  applyProfileEnvironment(effectiveProfile);
  applyEnvironmentVariableCollection(context, effectiveProfile);

  const statusBarItem = createStatusBarItem('claudeProfileSwitcher.openMenu');
  refreshStatusBar(statusBarItem, activeProfile);
  context.subscriptions.push(statusBarItem);

  registerCommands(context, statusBarItem);
}

export function deactivate(): void {}
