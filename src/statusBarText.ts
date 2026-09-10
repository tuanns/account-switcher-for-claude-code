import type { ClaudeProfile } from './profileStore';
import { identityTranslate, type Translate } from './i18n';

export function renderStatusBarText(
  activeProfile: ClaudeProfile | undefined,
  pinnedToWorkspace = false,
  t: Translate = identityTranslate
): string {
  if (!activeProfile) {
    return t('$(account) Claude: (none)');
  }
  return pinnedToWorkspace
    ? t('$(pinned) Claude: {0} (this workspace)', activeProfile.name)
    : t('$(account) Claude: {0}', activeProfile.name);
}
