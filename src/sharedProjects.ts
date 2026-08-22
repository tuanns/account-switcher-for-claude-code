import * as fs from 'fs';
import * as path from 'path';

/**
 * Claude Code CLI stores each project's conversation history (session
 * transcripts under `projects/<slug>/*.jsonl`, plus `projects/<slug>/memory/`)
 * inside `CLAUDE_CONFIG_DIR`. Since every profile has its own
 * `CLAUDE_CONFIG_DIR`, switching accounts used to orphan whatever history had
 * been written under the *previous* directory: the newly active directory's
 * `projects/` had never seen that project before, so Claude Code silently
 * started a brand-new session instead of resuming the old one.
 *
 * Session history isn't actually account-scoped (it holds no credentials),
 * so instead we make `<dirPath>/projects` a junction pointing at one
 * directory shared by every profile. Whichever account is active, the same
 * history is visible and resumable. Only `.credentials.json` and the
 * `oauthAccount` field stay per-profile (see `liveSwap.ts`).
 *
 * Idempotent and best-effort: if `<dirPath>/projects` still has an open file
 * in it (e.g. the transcript of a conversation that's actively running right
 * now), the directory can't be removed to make way for the junction — the
 * merge into the shared dir has already happened by that point though, so no
 * history is lost, and the junction swap is simply retried the next time
 * this is called for the same profile.
 */
export function ensureProjectsShared(dirPath: string, sharedDir: string): void {
  fs.mkdirSync(sharedDir, { recursive: true });
  const linkPath = path.join(dirPath, 'projects');

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
