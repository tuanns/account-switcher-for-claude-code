import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { getProfilesJsonPath, getUniqueProfileDirPath } from './paths';
import { validateNewProfileName, waitForCredentialsFile } from './addProfileLogic';
import { readOAuthAccountCache } from './migration';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function isClaudeCliAvailable(): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export async function runAddProfileFlow(): Promise<ClaudeProfile | undefined> {
  if (!isClaudeCliAvailable()) {
    vscode.window.showErrorMessage(
      'Khong tim thay lenh "claude" trong PATH. Hay cai Claude Code CLI truoc (npm install -g @anthropic-ai/claude-code) roi thu lai.'
    );
    return undefined;
  }

  const profilesJsonPath = getProfilesJsonPath();
  const existing = listProfiles(profilesJsonPath);

  const name = await vscode.window.showInputBox({
    prompt: 'Ten goi nho cho tai khoan Claude moi',
    placeHolder: 'Work',
    validateInput: (value) => validateNewProfileName(value, existing),
  });
  if (!name) {
    return undefined;
  }

  const dirPath = getUniqueProfileDirPath(name);
  fs.mkdirSync(dirPath, { recursive: true });

  const terminal = vscode.window.createTerminal({
    name: `Claude Login: ${name}`,
    env: { CLAUDE_CONFIG_DIR: dirPath },
  });
  terminal.show();
  terminal.sendText('claude');

  const credentialsPath = path.join(dirPath, '.credentials.json');
  const loggedIn = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Dang cho dang nhap cho "${name}"...`,
      cancellable: false,
    },
    () => waitForCredentialsFile(credentialsPath, LOGIN_TIMEOUT_MS)
  );

  if (!loggedIn) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    vscode.window.showWarningMessage(
      `Khong phat hien dang nhap thanh cong cho "${name}" (qua 5 phut). Da huy.`
    );
    return undefined;
  }

  const cache = readOAuthAccountCache(dirPath);
  const profile = addProfile(profilesJsonPath, {
    name,
    dirPath,
    email: cache.email,
    organizationName: cache.organizationName,
  });
  vscode.window.showInformationMessage(`Da them tai khoan "${name}".`);
  return profile;
}
