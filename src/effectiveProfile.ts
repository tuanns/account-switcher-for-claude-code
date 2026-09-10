import type { ClaudeProfile } from './profileStore';

export type EffectiveProfileSource = 'workspace' | 'global-pinned' | 'global-live' | 'none';

export interface EffectiveProfileInputs {
  /** This workspace's own pin, if any — see `workspacePin.ts`. */
  workspacePinnedId: string | undefined;
  /** The app-wide "last switched to" profile id — see `activeProfileState.ts`. */
  activeId: string | undefined;
  /** The app-wide "own dir, don't follow `_live`" flag — see `activeProfileState.ts`. */
  isPinned: boolean;
  liveDir: string;
  findProfile: (id: string) => ClaudeProfile | undefined;
}

export interface EffectiveProfileResult {
  profile: ClaudeProfile | undefined;
  dirPath: string | undefined;
  source: EffectiveProfileSource;
}

const NONE: EffectiveProfileResult = { profile: undefined, dirPath: undefined, source: 'none' };

/**
 * Decides which profile (and which directory) this window should actually
 * use, in priority order:
 *
 * 1. This workspace's own pin (`workspacePinnedId`), if set AND the pinned
 *    profile still exists. This always resolves to that profile's OWN
 *    directory — never `_live` — so it's immune to a `switchLive()` call
 *    made from any other window/workspace (see `liveSwap.ts`: that function
 *    only ever writes into `liveDir`, never into a profile's own dirPath).
 *    A workspace pin whose profile was since deleted is treated as unset
 *    (falls through to #2) rather than resolving to nothing, so deleting
 *    this workspace's pinned profile doesn't strand the window with no
 *    account at all.
 * 2. The app-wide active profile (shared across every window that hasn't
 *    set its own workspace pin) — `_live` if not globally pinned, or that
 *    profile's own dir if it is.
 */
export function resolveEffectiveProfile(inputs: EffectiveProfileInputs): EffectiveProfileResult {
  if (inputs.workspacePinnedId) {
    const pinned = inputs.findProfile(inputs.workspacePinnedId);
    if (pinned) {
      return { profile: pinned, dirPath: pinned.dirPath, source: 'workspace' };
    }
  }

  if (!inputs.activeId) {
    return NONE;
  }
  const active = inputs.findProfile(inputs.activeId);
  if (!active) {
    return NONE;
  }
  return inputs.isPinned
    ? { profile: active, dirPath: active.dirPath, source: 'global-pinned' }
    : { profile: active, dirPath: inputs.liveDir, source: 'global-live' };
}
