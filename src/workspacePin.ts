import * as vscode from 'vscode';

const WORKSPACE_PIN_KEY = 'workspacePinnedProfileId';

/**
 * Unlike `activeProfileId`/`isPinnedToOwnDir` in `activeProfileState.ts`
 * (stored in `context.globalState`, shared by every window of this VS Code
 * install), this is stored in `context.workspaceState` — scoped to the
 * specific folder/workspace open in this window. Switching accounts in a
 * totally unrelated window/project can never change this.
 */
export function getWorkspacePinnedProfileId(context: vscode.ExtensionContext): string | undefined {
  return context.workspaceState.get<string>(WORKSPACE_PIN_KEY);
}

export async function setWorkspacePinnedProfileId(
  context: vscode.ExtensionContext,
  id: string | undefined
): Promise<void> {
  await context.workspaceState.update(WORKSPACE_PIN_KEY, id);
}
