import type { ClaudeProfile } from './profileStore';

export function renderStatusBarText(activeProfile: ClaudeProfile | undefined): string {
  if (!activeProfile) {
    return '$(account) Claude: (none)';
  }
  return `$(account) Claude: ${activeProfile.name}`;
}
