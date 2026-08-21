import * as fs from 'fs';
import type { ClaudeProfile } from './profileStore';

export function validateNewProfileName(
  name: string,
  existingProfiles: ClaudeProfile[]
): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Ten profile khong duoc de trong';
  }
  const normalized = trimmed.toLowerCase();
  if (existingProfiles.some((p) => p.name.trim().toLowerCase() === normalized)) {
    return `Da co profile ten "${trimmed}"`;
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
