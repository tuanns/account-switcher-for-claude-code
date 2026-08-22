import * as fs from 'fs';
import * as path from 'path';

/**
 * Overwrites `<liveDir>/.credentials.json` with the credentials from
 * `<sourceDir>/.credentials.json`, and merges just the `oauthAccount` field
 * from `<sourceDir>/.claude.json` into `<liveDir>/.claude.json` (creating it
 * if missing). Every other key already present in the live dir's
 * `.claude.json` (projects, mcpServers, session cache, ...) is left
 * untouched, since a running conversation's project/session history lives
 * there and must not be wiped out by an account swap.
 */
export function swapCredentialsIntoLive(sourceDir: string, liveDir: string): void {
  const sourceCredentialsPath = path.join(sourceDir, '.credentials.json');
  if (!fs.existsSync(sourceCredentialsPath)) {
    throw new Error(`Source profile has no credentials file at ${sourceCredentialsPath}`);
  }

  fs.mkdirSync(liveDir, { recursive: true });
  const liveCredentialsPath = path.join(liveDir, '.credentials.json');
  fs.copyFileSync(sourceCredentialsPath, liveCredentialsPath);

  const sourceConfigPath = path.join(sourceDir, '.claude.json');
  let sourceOAuthAccount: unknown;
  try {
    const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigPath, 'utf8'));
    sourceOAuthAccount = sourceConfig?.oauthAccount;
  } catch {
    sourceOAuthAccount = undefined;
  }
  if (sourceOAuthAccount === undefined) {
    return;
  }

  const liveConfigPath = path.join(liveDir, '.claude.json');
  let liveConfig: Record<string, unknown> = {};
  try {
    liveConfig = JSON.parse(fs.readFileSync(liveConfigPath, 'utf8'));
  } catch {
    liveConfig = {};
  }
  liveConfig.oauthAccount = sourceOAuthAccount;
  fs.writeFileSync(liveConfigPath, JSON.stringify(liveConfig, null, 2), 'utf8');
}
