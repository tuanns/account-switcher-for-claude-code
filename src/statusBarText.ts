import type { ClaudeProfile } from './profileStore';
import { identityTranslate, type Translate } from './i18n';

export function renderStatusBarText(
  activeProfile: ClaudeProfile | undefined,
  t: Translate = identityTranslate
): string {
  if (!activeProfile) {
    return t('$(account) Claude: (none)');
  }
  return t('$(account) Claude: {0}', activeProfile.name);
}
