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
      'Không tìm thấy lệnh "claude" trong PATH. Hãy cài Claude Code CLI trước (npm install -g @anthropic-ai/claude-code) rồi thử lại.'
    );
    return undefined;
  }

  const profilesJsonPath = getProfilesJsonPath();
  const existing = listProfiles(profilesJsonPath);

  const name = await vscode.window.showInputBox({
    prompt: 'Tên gợi nhớ cho tài khoản Claude mới',
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
  const loginResult = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Đang chờ đăng nhập cho "${name}"...`,
      cancellable: true,
    },
    (_progress, token) =>
      Promise.race<'success' | 'timeout' | 'cancelled'>([
        waitForCredentialsFile(credentialsPath, LOGIN_TIMEOUT_MS).then((ok) =>
          ok ? 'success' : 'timeout'
        ),
        new Promise<'cancelled'>((resolve) => {
          token.onCancellationRequested(() => resolve('cancelled'));
        }),
      ])
  );

  if (loginResult !== 'success') {
    terminal.dispose();
    fs.rmSync(dirPath, { recursive: true, force: true });
    if (loginResult === 'timeout') {
      vscode.window.showWarningMessage(
        `Không phát hiện đăng nhập thành công cho "${name}" (quá 5 phút). Đã huỷ.`
      );
    } else {
      vscode.window.showInformationMessage(`Đã huỷ thêm tài khoản "${name}".`);
    }
    return undefined;
  }

  const cache = readOAuthAccountCache(dirPath);
  const profile = addProfile(profilesJsonPath, {
    name,
    dirPath,
    email: cache.email,
    organizationName: cache.organizationName,
  });
  vscode.window.showInformationMessage(`Đã thêm tài khoản "${name}".`);
  return profile;
}
