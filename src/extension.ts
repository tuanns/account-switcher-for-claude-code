import * as vscode from 'vscode';
import * as path from 'path';
import { getProfilesJsonPath, getLiveDir, getSharedMcpServersPath } from './paths';
import { findProfile } from './profileStore';
import { tryFirstRunMigration } from './migration';
import { getActiveProfileId, setActiveProfileId, getIsPinned } from './activeProfileState';
import { getWorkspacePinnedProfileId } from './workspacePin';
import { resolveEffectiveProfile } from './effectiveProfile';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { createStatusBarItem, refreshStatusBar } from './statusBar';
import { registerCommands } from './commands';
import { swapCredentialsIntoLive } from './liveSwap';
import { ensureAllDirsShared } from './sharedDirs';
import { syncMcpServers } from './mcpServersSync';

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

  const resolved = resolveEffectiveProfile({
    workspacePinnedId: getWorkspacePinnedProfileId(context),
    activeId: activeProfile?.id,
    isPinned: getIsPinned(context),
    liveDir: getLiveDir(),
    findProfile: (id) => findProfile(profilesJsonPath, id),
  });
  const effectiveProfile =
    resolved.profile && resolved.dirPath ? { ...resolved.profile, dirPath: resolved.dirPath } : undefined;

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
    // mcpServers can't be junctioned away like projects/plugins/skills
    // above (it's a key inside .claude.json, not a subdirectory) — sync it
    // into/out of the shared registry instead. See mcpServersSync.ts.
    try {
      syncMcpServers(path.join(effectiveProfile.dirPath, '.claude.json'), getSharedMcpServersPath());
    } catch {
      // Best-effort; a later activation/switch retries it.
    }
  }

  applyProfileEnvironment(effectiveProfile);
  applyEnvironmentVariableCollection(context, effectiveProfile);

  const statusBarItem = createStatusBarItem('profileSwitcherForClaudeCode.openMenu');
  refreshStatusBar(statusBarItem, resolved.profile, resolved.source === 'workspace');
  context.subscriptions.push(statusBarItem);

  registerCommands(context, statusBarItem);
}

export function deactivate(): void {}
