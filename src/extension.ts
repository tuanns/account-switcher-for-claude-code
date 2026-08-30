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
import { ensureAllDirsShared } from './sharedDirs';

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

  if (effectiveProfile) {
    // Lazily upgrade this directory's projects/plugins/skills to shared
    // junctions on every activation, so profiles/​the `_live` dir created
    // before this feature existed (or last touched by an older version)
    // get migrated the next time they're actually used, without a
    // disruptive upfront migration of every profile at once.
    try {
      ensureAllDirsShared(effectiveProfile.dirPath);
    } catch {
      // Best-effort; a later switch retries it.
    }
  }

  applyProfileEnvironment(effectiveProfile);
  applyEnvironmentVariableCollection(context, effectiveProfile);

  const statusBarItem = createStatusBarItem('accountSwitcherForClaudeCode.openMenu');
  refreshStatusBar(statusBarItem, activeProfile);
  context.subscriptions.push(statusBarItem);

  registerCommands(context, statusBarItem);
}

export function deactivate(): void {}
