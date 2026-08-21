import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';
import { renderStatusBarText } from './statusBarText';

export function createStatusBarItem(commandId: string): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = commandId;
  item.text = renderStatusBarText(undefined);
  item.tooltip = 'Chuyển tài khoản Claude';
  item.show();
  return item;
}

export function refreshStatusBar(
  item: vscode.StatusBarItem,
  activeProfile: ClaudeProfile | undefined
): void {
  item.text = renderStatusBarText(activeProfile);
}
