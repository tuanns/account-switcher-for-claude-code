import * as vscode from 'vscode';

const ACTIVE_PROFILE_KEY = 'activeProfileId';
const IS_PINNED_KEY = 'isPinnedToOwnDir';

export function getActiveProfileId(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get<string>(ACTIVE_PROFILE_KEY);
}

export async function setActiveProfileId(
  context: vscode.ExtensionContext,
  id: string | undefined
): Promise<void> {
  await context.globalState.update(ACTIVE_PROFILE_KEY, id);
}

/**
 * Whether this window is "pinned" to the active profile's own directory
 * (isolated per-window switching) instead of the shared `_live` directory
 * (switching there affects every window/process currently pointed at it).
 * Defaults to false (shared/live mode) when never set.
 */
export function getIsPinned(context: vscode.ExtensionContext): boolean {
  return context.globalState.get<boolean>(IS_PINNED_KEY) ?? false;
}

export async function setIsPinned(context: vscode.ExtensionContext, pinned: boolean): Promise<void> {
  await context.globalState.update(IS_PINNED_KEY, pinned);
}
