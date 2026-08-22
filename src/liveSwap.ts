import * as fs from 'fs';
import * as path from 'path';

/**
 * Overwrites `<liveDir>/.credentials.json` with the credentials from
 * `<sourceDir>/.credentials.json`.
 *
 * For `<liveDir>/.claude.json`:
 * - If it doesn't exist yet (first time this live dir is ever seeded, e.g.
 *   first-run migration), the ENTIRE `<sourceDir>/.claude.json` is copied
 *   over as-is, so any pre-existing project/session history the source
 *   profile already had (most commonly the user's original `~/.claude`)
 *   carries into the live dir instead of being silently dropped.
 * - If it already exists, only the `oauthAccount` field is merged in. Every
 *   other key already present (projects, mcpServers, session cache, ...) is
 *   left untouched, since a running conversation's project/session history
 *   lives there and must not be wiped out by an account swap.
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
  const liveConfigPath = path.join(liveDir, '.claude.json');

  if (!fs.existsSync(liveConfigPath)) {
    if (fs.existsSync(sourceConfigPath)) {
      fs.copyFileSync(sourceConfigPath, liveConfigPath);
    }
    return;
  }

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

  let liveConfig: Record<string, unknown> = {};
  try {
    liveConfig = JSON.parse(fs.readFileSync(liveConfigPath, 'utf8'));
  } catch {
    liveConfig = {};
  }
  liveConfig.oauthAccount = sourceOAuthAccount;
  fs.writeFileSync(liveConfigPath, JSON.stringify(liveConfig, null, 2), 'utf8');
}
