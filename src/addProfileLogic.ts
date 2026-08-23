import * as fs from 'fs';
import type { ClaudeProfile } from './profileStore';
import { identityTranslate, type Translate } from './i18n';

export function validateNewProfileName(
  name: string,
  existingProfiles: ClaudeProfile[],
  t: Translate = identityTranslate
): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return t('Tên profile không được để trống');
  }
  const normalized = trimmed.toLowerCase();
  if (existingProfiles.some((p) => p.name.trim().toLowerCase() === normalized)) {
    return t('Đã có profile tên "{0}"', trimmed);
  }
  return undefined;
}

export function waitForCredentialsFile(
  credentialsFilePath: string,
  timeoutMs: number,
  pollIntervalMs: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (fs.existsSync(credentialsFilePath)) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, pollIntervalMs);
    };
    check();
  });
}
