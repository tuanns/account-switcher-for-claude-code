import * as fs from 'fs';
import * as path from 'path';

/**
 * Detects a specific corruption observed in the wild: a profile's own
 * `.credentials.json` with `accessToken`/`refreshToken` wiped to empty
 * strings (as opposed to the file simply not existing yet, which just means
 * "never logged in" — not corruption). Best guess at the cause: two
 * processes sharing one profile's `CLAUDE_CONFIG_DIR` both held the same
 * (single-use/rotating) refresh token; whichever refreshed first invalidated
 * the other's copy, and the official CLI's failed-refresh path cleared the
 * file instead of failing safely. See README "Current limitations".
 *
 * Best-effort: any file that doesn't exist or can't be parsed is treated as
 * "not wiped" (a different problem, not this one) rather than flagged.
 */
export function isCredentialsWiped(dirPath: string): boolean {
  const credentialsPath = path.join(dirPath, '.credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    return false;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const token = raw?.claudeAiOauth ?? raw;
    return !token?.accessToken && !token?.refreshToken;
  } catch {
    return false;
  }
}
