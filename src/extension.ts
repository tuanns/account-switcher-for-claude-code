import * as vscode from 'vscode';
import { getProfilesJsonPath } from './paths';
import { findProfile } from './profileStore';
import { tryFirstRunMigration } from './migration';
import { getActiveProfileId, setActiveProfileId } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { createStatusBarItem, refreshStatusBar } from './statusBar';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();

  const activeId = getActiveProfileId(context);
  let activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;

  if (!activeProfile) {
    const migrated = tryFirstRunMigration(profilesJsonPath);
    if (migrated) {
      await setActiveProfileId(context, migrated.id);
      activeProfile = migrated;
    }
  }

  applyProfileEnvironment(activeProfile);
  applyEnvironmentVariableCollection(context, activeProfile);

  const statusBarItem = createStatusBarItem('claudeProfileSwitcher.openMenu');
  refreshStatusBar(statusBarItem, activeProfile);
  context.subscriptions.push(statusBarItem);

  registerCommands(context, statusBarItem);
}

export function deactivate(): void {}
