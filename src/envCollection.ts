import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

const ENV_VAR_NAME = 'CLAUDE_CONFIG_DIR';

export function applyEnvironmentVariableCollection(
  context: vscode.ExtensionContext,
  activeProfile: ClaudeProfile | undefined
): void {
  const collection = context.environmentVariableCollection;
  collection.clear();
  if (activeProfile) {
    collection.replace(ENV_VAR_NAME, activeProfile.dirPath);
  }
}
