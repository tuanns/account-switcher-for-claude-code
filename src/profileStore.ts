import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ClaudeProfile {
  id: string;
  name: string;
  dirPath: string;
  email?: string;
  organizationName?: string;
  createdAt: string;
}

interface ProfilesFile {
  profiles: ClaudeProfile[];
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readProfilesFile(profilesJsonPath: string): ProfilesFile {
  if (!fs.existsSync(profilesJsonPath)) {
    return { profiles: [] };
  }
  const raw = fs.readFileSync(profilesJsonPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.profiles)) {
      throw new Error('missing profiles array');
    }
    return parsed as ProfilesFile;
  } catch {
    const backupPath = `${profilesJsonPath}.bak`;
    fs.copyFileSync(profilesJsonPath, backupPath);
    return { profiles: [] };
  }
}

export function writeProfilesFile(profilesJsonPath: string, data: ProfilesFile): void {
  ensureParentDir(profilesJsonPath);
  fs.writeFileSync(profilesJsonPath, JSON.stringify(data, null, 2), 'utf8');
}

export function listProfiles(profilesJsonPath: string): ClaudeProfile[] {
  return readProfilesFile(profilesJsonPath).profiles;
}

export function findProfile(profilesJsonPath: string, id: string): ClaudeProfile | undefined {
  return listProfiles(profilesJsonPath).find((p) => p.id === id);
}

export function isNameTaken(profiles: ClaudeProfile[], name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return profiles.some((p) => p.name.trim().toLowerCase() === normalized);
}

export function addProfile(
  profilesJsonPath: string,
  input: { name: string; dirPath: string; email?: string; organizationName?: string }
): ClaudeProfile {
  const data = readProfilesFile(profilesJsonPath);
  if (isNameTaken(data.profiles, input.name)) {
    throw new Error(`Profile name "${input.name}" already exists`);
  }
  const profile: ClaudeProfile = {
    id: crypto.randomUUID(),
    name: input.name,
    dirPath: input.dirPath,
    createdAt: new Date().toISOString(),
  };
  if (input.email !== undefined) {
    profile.email = input.email;
  }
  if (input.organizationName !== undefined) {
    profile.organizationName = input.organizationName;
  }
  data.profiles.push(profile);
  writeProfilesFile(profilesJsonPath, data);
  return profile;
}

export function renameProfile(profilesJsonPath: string, id: string, newName: string): void {
  const data = readProfilesFile(profilesJsonPath);
  const profile = data.profiles.find((p) => p.id === id);
  if (!profile) {
    throw new Error(`Profile "${id}" not found`);
  }
  const others = data.profiles.filter((p) => p.id !== id);
  if (isNameTaken(others, newName)) {
    throw new Error(`Profile name "${newName}" already exists`);
  }
  profile.name = newName;
  writeProfilesFile(profilesJsonPath, data);
}

export function removeProfile(profilesJsonPath: string, id: string): void {
  const data = readProfilesFile(profilesJsonPath);
  const next = data.profiles.filter((p) => p.id !== id);
  if (next.length === data.profiles.length) {
    throw new Error(`Profile "${id}" not found`);
  }
  writeProfilesFile(profilesJsonPath, { profiles: next });
}
