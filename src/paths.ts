import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export function getProfilesRoot(): string {
  return path.join(os.homedir(), '.claude-profiles');
}

export function getProfilesJsonPath(): string {
  return path.join(getProfilesRoot(), 'profiles.json');
}

/**
 * The one fixed "live" config directory that windows use by default (not
 * pinned to a specific profile's own directory). Switching a profile "live"
 * overwrites this directory's credentials in place, so an already-running
 * conversation whose process is bound to this directory picks up the new
 * account without needing a new conversation.
 */
export function getLiveDir(): string {
  return path.join(getProfilesRoot(), '_live');
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'profile';
}

export function getUniqueProfileDirPath(name: string, root: string = getProfilesRoot()): string {
  const baseSlug = slugify(name);
  let candidate = path.join(root, baseSlug);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(root, `${baseSlug}-${suffix}`);
    suffix++;
  }
  return candidate;
}
