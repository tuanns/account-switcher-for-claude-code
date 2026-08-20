import type { ClaudeProfile } from './profileStore';

const ENV_VAR_NAME = 'CLAUDE_CONFIG_DIR';

export function applyProfileEnvironment(profile: ClaudeProfile | undefined): void {
  if (profile) {
    process.env[ENV_VAR_NAME] = profile.dirPath;
  } else {
    delete process.env[ENV_VAR_NAME];
  }
}
