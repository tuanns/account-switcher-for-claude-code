import * as fs from 'fs';
import * as path from 'path';
import { getSharedDir } from './paths';

/**
 * Subdirectories of `CLAUDE_CONFIG_DIR` that are account-agnostic and so get
 * shared across every profile via `ensureDirShared`. Add a new name here
 * (and it starts getting shared from the next profile switch/activation
 * onward) if another one turns out to have the same "looks lost after
 * switching accounts" problem as `projects`/`plugins`/`skills` did.
 */
export const SHARED_SUBDIR_NAMES = ['projects', 'plugins', 'skills'] as const;

/**
 * Runs `ensureDirShared` for every entry in `SHARED_SUBDIR_NAMES` against
 * `dirPath`. `sharedDirFor` resolves a subdir name to its shared-root path
 * and defaults to the real `getSharedDir` (i.e. under `~/.claude-profiles`)
 * — tests override it to stay inside a temp dir instead of touching the
 * real one on whatever machine runs them.
 */
export function ensureAllDirsShared(
  dirPath: string,
  sharedDirFor: (name: string) => string = getSharedDir
): void {
  for (const name of SHARED_SUBDIR_NAMES) {
    ensureDirShared(dirPath, name, sharedDirFor(name));
  }
}

/**
 * Claude Code CLI keeps several kinds of state under a subdirectory of
 * `CLAUDE_CONFIG_DIR` that has nothing to do with *which account* is
 * logged in — conversation history (`projects/`), installed plugins
 * (`plugins/`), installed skills (`skills/`). Since every profile has its
 * own `CLAUDE_CONFIG_DIR`, switching accounts used to silently lose access
 * to whichever of these lived under the *previous* directory: the newly
 * active directory's copy had never seen it, so it just looked empty/gone
 * (first observed with conversation history, see git history of
 * `sharedProjects.ts`; the same root cause turned out to also apply to
 * `plugins/` and `skills/`).
 *
 * Instead of copying this state around on every switch, `<dirPath>/<subdirName>`
 * is made a junction pointing at one directory shared by every profile —
 * whichever account is active, the same content is visible. Only
 * `.credentials.json` and the `oauthAccount` field stay per-profile (see
 * `liveSwap.ts`).
 *
 * Idempotent and best-effort: if the directory still has an open file in it
 * (e.g. mid-write), it can't be removed to make way for the junction — the
 * merge into the shared dir has already happened by that point though, so
 * nothing is lost, and the junction swap is simply retried the next time
 * this is called for the same profile/subdir.
 */
export function ensureDirShared(dirPath: string, subdirName: string, sharedDir: string): void {
  fs.mkdirSync(sharedDir, { recursive: true });
  const linkPath = path.join(dirPath, subdirName);

  if (!fs.existsSync(linkPath)) {
    fs.symlinkSync(sharedDir, linkPath, 'junction');
    return;
  }

  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    return;
  }

  mergeDirInto(linkPath, sharedDir);
  try {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    return;
  }
  fs.symlinkSync(sharedDir, linkPath, 'junction');
}

/** Recursively copies files from `sourceDir` into `destDir`, skipping any path that already exists at the destination. */
function mergeDirInto(sourceDir: string, destDir: string): void {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      mergeDirInto(src, dest);
    } else if (entry.isFile() && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
}
