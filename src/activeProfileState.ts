import * as vscode from 'vscode';

const ACTIVE_PROFILE_KEY = 'activeProfileId';

export function getActiveProfileId(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get<string>(ACTIVE_PROFILE_KEY);
}

export async function setActiveProfileId(
  context: vscode.ExtensionContext,
  id: string | undefined
): Promise<void> {
  await context.globalState.update(ACTIVE_PROFILE_KEY, id);
}
