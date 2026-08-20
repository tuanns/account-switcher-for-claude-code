import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';

export function getDefaultClaudeDir(): string {
  return path.join(os.homedir(), '.claude');
}

export function hasExistingLogin(claudeDir: string): boolean {
  return fs.existsSync(path.join(claudeDir, '.credentials.json'));
}

interface OAuthAccountCache {
  email?: string;
  organizationName?: string;
}

export function readOAuthAccountCache(claudeDir: string): OAuthAccountCache {
  const configPath = path.join(claudeDir, '.claude.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const account = parsed?.oauthAccount ?? {};
    return {
      email: typeof account.emailAddress === 'string' ? account.emailAddress : undefined,
      organizationName:
        typeof account.organizationName === 'string' ? account.organizationName : undefined,
    };
  } catch {
    return {};
  }
}

export function tryFirstRunMigration(
  profilesJsonPath: string,
  claudeDir: string = getDefaultClaudeDir()
): ClaudeProfile | undefined {
  if (listProfiles(profilesJsonPath).length > 0) {
    return undefined;
  }
  if (!hasExistingLogin(claudeDir)) {
    return undefined;
  }
  const cache = readOAuthAccountCache(claudeDir);
  return addProfile(profilesJsonPath, {
    name: 'Default',
    dirPath: claudeDir,
    email: cache.email,
    organizationName: cache.organizationName,
  });
}
