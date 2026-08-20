# Claude Profile Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode desktop extension that lets a user store multiple Claude Code logins ("profiles"), switch the active one with one click (no re-login), and have it apply to the official "Claude Code" chat panel immediately.

**Architecture:** Each profile is a directory used as `CLAUDE_CONFIG_DIR` (Claude Code's own env-var override for its config/credentials location, verified in `cli.js`). Switching sets `process.env.CLAUDE_CONFIG_DIR` in the shared VSCode Extension Host process (which the official `anthropic.claude-code` extension reads on every new `claude` subprocess spawn — verified in its `extension.js`), plus registers the var for new integrated terminals via the official `environmentVariableCollection` API. Profile metadata lives in a shared JSON file (`~/.claude-profiles/profiles.json`); which profile is "active" is stored per VSCode Profile via `ExtensionContext.globalState` (VSCode isolates this storage per Profile automatically).

**Tech Stack:** TypeScript, VSCode Extension API (`@types/vscode`), Node.js built-in `node:test` for unit tests (no extra test framework), `@vscode/vsce` for packaging.

Spec: `docs/superpowers/specs/2026-08-20-claude-profile-switcher-design.md`

---

## Prerequisites

- Node.js >= 18 installed (`node --version`).
- VSCode installed (for manual smoke testing in Task 8).
- `claude` CLI installed and in PATH (for manual smoke testing).

## File Structure

```
switch.profile/
  package.json
  tsconfig.json
  .gitignore
  .vscodeignore
  README.md
  src/
    extension.ts          # activate/deactivate entrypoint
    paths.ts               # profile dir/json paths, slugify (pure)
    profileStore.ts        # profiles.json CRUD (pure)
    migration.ts           # first-run import of existing ~/.claude (pure)
    envApply.ts            # process.env.CLAUDE_CONFIG_DIR set/clear (pure)
    statusBarText.ts       # status bar label formatting (pure)
    addProfileLogic.ts     # name validation + wait-for-login polling (pure)
    activeProfileState.ts  # globalState get/set active profile id (vscode)
    statusBar.ts           # StatusBarItem creation/refresh (vscode)
    envCollection.ts       # environmentVariableCollection wiring (vscode)
    quickPick.ts           # menu QuickPicks (vscode)
    addProfileFlow.ts      # "add new profile" login flow (vscode)
    manageProfilesFlow.ts  # rename/remove flows (vscode)
    commands.ts            # command registration + switch logic (vscode)
  test/
    paths.test.ts
    profileStore.test.ts
    migration.test.ts
    envApply.test.ts
    statusBarText.test.ts
    addProfileLogic.test.ts
```

Files suffixed "(pure)" have no `vscode` import and are unit tested with `node:test`. Files suffixed "(vscode)" need a running Extension Host to execute and are verified via the manual smoke-test checklist in Task 8 (Section 9 of the spec) rather than automated tests — pulling in `@vscode/test-electron` for full extension-host testing is out of scope for this personal-use extension (YAGNI).

---

### Task 1: Scaffold the extension project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `src/extension.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claude-profile-switcher",
  "displayName": "Claude Profile Switcher",
  "description": "Chuyen doi nhanh giua nhieu tai khoan Claude Code da dang nhap, khong can dang nhap lai.",
  "version": "0.1.0",
  "publisher": "local",
  "private": true,
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": ["Other"],
  "main": "./out/src/extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "commands": [
      {
        "command": "claudeProfileSwitcher.openMenu",
        "title": "Claude Profile Switcher: Open Menu"
      }
    ]
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -w -p ./",
    "test": "npm run compile && node --test out/test",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/vscode": "^1.90.0",
    "typescript": "^5.6.0",
    "@vscode/vsce": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "rootDir": ".",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
out/
node_modules/
*.vsix
```

- [ ] **Step 4: Create `.vscodeignore`**

```
.vscode/**
src/**
test/**
docs/**
.git/**
.gitignore
tsconfig.json
**/*.ts
**/*.map
```

- [ ] **Step 5: Create minimal `src/extension.ts` stub**

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {}

export function deactivate(): void {}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 7: Verify the project compiles**

Run: `npm run compile`
Expected: exits with code 0, creates `out/src/extension.js`.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore .vscodeignore src/extension.ts package-lock.json
git commit -m "chore: scaffold claude-profile-switcher extension project

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `paths.ts` — profile paths and slugify

**Files:**
- Create: `src/paths.ts`
- Test: `test/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/paths.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { slugify, getUniqueProfileDirPath } from '../src/paths';

test('slugify lowercases and replaces non-alphanumeric with dashes', () => {
  assert.equal(slugify('Work Account'), 'work-account');
});

test('slugify collapses repeated separators and trims edges', () => {
  assert.equal(slugify('  Hello!!  World??  '), 'hello-world');
});

test('slugify falls back to "profile" when nothing alphanumeric remains', () => {
  assert.equal(slugify('!!!'), 'profile');
});

test('getUniqueProfileDirPath returns base slug path when free', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-test-'));
  const result = getUniqueProfileDirPath('Work', root);
  assert.equal(result, path.join(root, 'work'));
});

test('getUniqueProfileDirPath appends numeric suffix when slug taken', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-test-'));
  fs.mkdirSync(path.join(root, 'work'));
  const result = getUniqueProfileDirPath('Work', root);
  assert.equal(result, path.join(root, 'work-2'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/paths'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/paths.ts
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export function getProfilesRoot(): string {
  return path.join(os.homedir(), '.claude-profiles');
}

export function getProfilesJsonPath(): string {
  return path.join(getProfilesRoot(), 'profiles.json');
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests in `paths.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/paths.ts test/paths.test.ts
git commit -m "feat: add profile path helpers and slugify

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `profileStore.ts` — profiles.json CRUD

**Files:**
- Create: `src/profileStore.ts`
- Test: `test/profileStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/profileStore.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addProfile,
  listProfiles,
  findProfile,
  renameProfile,
  removeProfile,
  readProfilesFile,
} from '../src/profileStore';

function tempProfilesJsonPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-store-'));
  return path.join(dir, 'profiles.json');
}

test('listProfiles returns empty array when file does not exist', () => {
  const p = tempProfilesJsonPath();
  assert.deepEqual(listProfiles(p), []);
});

test('addProfile creates a profile with id and createdAt, persists to disk', () => {
  const p = tempProfilesJsonPath();
  const profile = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  assert.equal(profile.name, 'Work');
  assert.equal(profile.dirPath, 'C:\\fake\\work');
  assert.ok(profile.id);
  assert.ok(profile.createdAt);
  assert.equal(listProfiles(p).length, 1);
  assert.deepEqual(findProfile(p, profile.id), profile);
});

test('addProfile rejects duplicate name case-insensitively', () => {
  const p = tempProfilesJsonPath();
  addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  assert.throws(() => addProfile(p, { name: 'work', dirPath: 'C:\\fake\\other' }));
});

test('renameProfile updates name and rejects clash with another profile', () => {
  const p = tempProfilesJsonPath();
  const a = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  addProfile(p, { name: 'Personal', dirPath: 'C:\\fake\\personal' });
  renameProfile(p, a.id, 'Work2');
  assert.equal(findProfile(p, a.id)?.name, 'Work2');
  assert.throws(() => renameProfile(p, a.id, 'Personal'));
});

test('removeProfile deletes the entry and throws for unknown id', () => {
  const p = tempProfilesJsonPath();
  const a = addProfile(p, { name: 'Work', dirPath: 'C:\\fake\\work' });
  removeProfile(p, a.id);
  assert.equal(listProfiles(p).length, 0);
  assert.throws(() => removeProfile(p, a.id));
});

test('readProfilesFile recovers from a corrupt file by backing it up and starting fresh', () => {
  const p = tempProfilesJsonPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '{ not valid json', 'utf8');
  const data = readProfilesFile(p);
  assert.deepEqual(data.profiles, []);
  assert.ok(fs.existsSync(`${p}.bak`));
  assert.equal(fs.readFileSync(`${p}.bak`, 'utf8'), '{ not valid json');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/profileStore'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/profileStore.ts
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
    email: input.email,
    organizationName: input.organizationName,
    createdAt: new Date().toISOString(),
  };
  data.profiles.push(profile);
  writeProfilesFile(profilesJsonPath, data);
  return profile;
}

export function renameProfile(profilesJsonPath: string, id: string, newName: string): void {
  const data = readProfilesFile(profilesJsonPath);
  const profile = data.profiles.find((p) => p.id === id);
  if (!profile) {
    throw new Error(`Profile ${id} not found`);
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
    throw new Error(`Profile ${id} not found`);
  }
  writeProfilesFile(profilesJsonPath, { profiles: next });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `profileStore.test.js` green (plus `paths.test.js` still green).

- [ ] **Step 5: Commit**

```bash
git add src/profileStore.ts test/profileStore.test.ts
git commit -m "feat: add profiles.json CRUD store with corrupt-file recovery

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `migration.ts` — first-run import of existing login

**Files:**
- Create: `src/migration.ts`
- Test: `test/migration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/migration.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addProfile, listProfiles } from '../src/profileStore';
import { tryFirstRunMigration } from '../src/migration';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('tryFirstRunMigration does nothing when no existing login found', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.equal(result, undefined);
  assert.deepEqual(listProfiles(profilesJsonPath), []);
});

test('tryFirstRunMigration imports existing ~/.claude as a Default profile', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}', 'utf8');
  fs.writeFileSync(
    path.join(claudeDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'me@example.com', organizationName: 'Acme' } }),
    'utf8'
  );
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.ok(result);
  assert.equal(result?.name, 'Default');
  assert.equal(result?.dirPath, claudeDir);
  assert.equal(result?.email, 'me@example.com');
  assert.equal(result?.organizationName, 'Acme');
  assert.equal(listProfiles(profilesJsonPath).length, 1);
});

test('tryFirstRunMigration skips when a profile already exists', () => {
  const profilesJsonPath = path.join(tempDir('cps-mig-'), 'profiles.json');
  const claudeDir = tempDir('cps-claude-');
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}', 'utf8');
  addProfile(profilesJsonPath, { name: 'Existing', dirPath: 'C:\\fake' });
  const result = tryFirstRunMigration(profilesJsonPath, claudeDir);
  assert.equal(result, undefined);
  assert.equal(listProfiles(profilesJsonPath).length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/migration'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/migration.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `migration.test.js` green (plus previous test files still green).

- [ ] **Step 5: Commit**

```bash
git add src/migration.ts test/migration.test.ts
git commit -m "feat: add first-run migration of existing ~/.claude login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `envApply.ts` — pure CLAUDE_CONFIG_DIR set/clear

**Files:**
- Create: `src/envApply.ts`
- Test: `test/envApply.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/envApply.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyProfileEnvironment } from '../src/envApply';
import type { ClaudeProfile } from '../src/profileStore';

test('applyProfileEnvironment sets CLAUDE_CONFIG_DIR from the given profile', () => {
  const before = process.env.CLAUDE_CONFIG_DIR;
  try {
    const profile: ClaudeProfile = {
      id: '1',
      name: 'Work',
      dirPath: 'C:\\fake\\work',
      createdAt: new Date().toISOString(),
    };
    applyProfileEnvironment(profile);
    assert.equal(process.env.CLAUDE_CONFIG_DIR, 'C:\\fake\\work');
  } finally {
    if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = before;
  }
});

test('applyProfileEnvironment clears CLAUDE_CONFIG_DIR when given undefined', () => {
  const before = process.env.CLAUDE_CONFIG_DIR;
  try {
    process.env.CLAUDE_CONFIG_DIR = 'C:\\fake\\stale';
    applyProfileEnvironment(undefined);
    assert.equal(process.env.CLAUDE_CONFIG_DIR, undefined);
  } finally {
    if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = before;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/envApply'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/envApply.ts
import type { ClaudeProfile } from './profileStore';

const ENV_VAR_NAME = 'CLAUDE_CONFIG_DIR';

export function applyProfileEnvironment(profile: ClaudeProfile | undefined): void {
  if (profile) {
    process.env[ENV_VAR_NAME] = profile.dirPath;
  } else {
    delete process.env[ENV_VAR_NAME];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `envApply.test.js` green (plus previous test files still green).

- [ ] **Step 5: Commit**

```bash
git add src/envApply.ts test/envApply.test.ts
git commit -m "feat: add pure CLAUDE_CONFIG_DIR apply/clear helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `statusBarText.ts` — status bar label formatting

**Files:**
- Create: `src/statusBarText.ts`
- Test: `test/statusBarText.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/statusBarText.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderStatusBarText } from '../src/statusBarText';
import type { ClaudeProfile } from '../src/profileStore';

test('renderStatusBarText shows placeholder when no active profile', () => {
  assert.equal(renderStatusBarText(undefined), '$(account) Claude: (none)');
});

test('renderStatusBarText shows the active profile name', () => {
  const profile: ClaudeProfile = {
    id: '1',
    name: 'Work',
    dirPath: 'C:\\fake\\work',
    createdAt: new Date().toISOString(),
  };
  assert.equal(renderStatusBarText(profile), '$(account) Claude: Work');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/statusBarText'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/statusBarText.ts
import type { ClaudeProfile } from './profileStore';

export function renderStatusBarText(activeProfile: ClaudeProfile | undefined): string {
  if (!activeProfile) {
    return '$(account) Claude: (none)';
  }
  return `$(account) Claude: ${activeProfile.name}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `statusBarText.test.js` green (plus previous test files still green).

- [ ] **Step 5: Commit**

```bash
git add src/statusBarText.ts test/statusBarText.test.ts
git commit -m "feat: add status bar label formatting helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `addProfileLogic.ts` — name validation + wait-for-login polling

**Files:**
- Create: `src/addProfileLogic.ts`
- Test: `test/addProfileLogic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/addProfileLogic.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateNewProfileName, waitForCredentialsFile } from '../src/addProfileLogic';
import type { ClaudeProfile } from '../src/profileStore';

function makeProfile(name: string): ClaudeProfile {
  return { id: name, name, dirPath: `C:\\fake\\${name}`, createdAt: new Date().toISOString() };
}

test('validateNewProfileName rejects empty name', () => {
  assert.equal(validateNewProfileName('   ', []), 'Ten profile khong duoc de trong');
});

test('validateNewProfileName rejects duplicate name case-insensitively', () => {
  assert.equal(
    validateNewProfileName('work', [makeProfile('Work')]),
    'Da co profile ten "work"'
  );
});

test('validateNewProfileName accepts a unique non-empty name', () => {
  assert.equal(validateNewProfileName('Personal', [makeProfile('Work')]), undefined);
});

test('waitForCredentialsFile resolves true once the file appears', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-wait-'));
  const filePath = path.join(dir, '.credentials.json');
  setTimeout(() => fs.writeFileSync(filePath, '{}', 'utf8'), 300);
  const result = await waitForCredentialsFile(filePath, 5000, 100);
  assert.equal(result, true);
});

test('waitForCredentialsFile resolves false after timeout when file never appears', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-wait-'));
  const filePath = path.join(dir, '.credentials.json');
  const result = await waitForCredentialsFile(filePath, 300, 100);
  assert.equal(result, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL to compile — `Cannot find module '../src/addProfileLogic'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/addProfileLogic.ts
import * as fs from 'fs';
import type { ClaudeProfile } from './profileStore';

export function validateNewProfileName(
  name: string,
  existingProfiles: ClaudeProfile[]
): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Ten profile khong duoc de trong';
  }
  const normalized = trimmed.toLowerCase();
  if (existingProfiles.some((p) => p.name.trim().toLowerCase() === normalized)) {
    return `Da co profile ten "${trimmed}"`;
  }
  return undefined;
}

export function waitForCredentialsFile(
  credentialsFilePath: string,
  timeoutMs: number,
  pollIntervalMs: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (fs.existsSync(credentialsFilePath)) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, pollIntervalMs);
    };
    check();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `addProfileLogic.test.js` green (plus every previous test file still green — 6 test files total now).

- [ ] **Step 5: Commit**

```bash
git add src/addProfileLogic.ts test/addProfileLogic.test.ts
git commit -m "feat: add profile-name validation and login-wait polling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: VSCode glue layer — status bar, menus, flows, commands, activation

This task wires the pure modules from Tasks 2–7 into an actual VSCode extension. These
files require a running Extension Host and are **not** covered by `node:test`; they are
verified with the manual smoke test in Step 10.

**Files:**
- Create: `src/activeProfileState.ts`
- Create: `src/statusBar.ts`
- Create: `src/envCollection.ts`
- Create: `src/quickPick.ts`
- Create: `src/addProfileFlow.ts`
- Create: `src/manageProfilesFlow.ts`
- Create: `src/commands.ts`
- Modify: `src/extension.ts` (replace the Task 1 stub)

- [ ] **Step 1: Create `src/activeProfileState.ts`**

```ts
// src/activeProfileState.ts
import * as vscode from 'vscode';

const ACTIVE_PROFILE_KEY = 'activeProfileId';

export function getActiveProfileId(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get<string>(ACTIVE_PROFILE_KEY);
}

export async function setActiveProfileId(
  context: vscode.ExtensionContext,
  id: string | undefined
): Promise<void> {
  await context.globalState.update(ACTIVE_PROFILE_KEY, id);
}
```

- [ ] **Step 2: Create `src/statusBar.ts`**

```ts
// src/statusBar.ts
import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';
import { renderStatusBarText } from './statusBarText';

export function createStatusBarItem(commandId: string): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = commandId;
  item.text = renderStatusBarText(undefined);
  item.tooltip = 'Chuyen tai khoan Claude';
  item.show();
  return item;
}

export function refreshStatusBar(
  item: vscode.StatusBarItem,
  activeProfile: ClaudeProfile | undefined
): void {
  item.text = renderStatusBarText(activeProfile);
}
```

- [ ] **Step 3: Create `src/envCollection.ts`**

```ts
// src/envCollection.ts
import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

const ENV_VAR_NAME = 'CLAUDE_CONFIG_DIR';

export function applyEnvironmentVariableCollection(
  context: vscode.ExtensionContext,
  activeProfile: ClaudeProfile | undefined
): void {
  const collection = context.environmentVariableCollection;
  collection.clear();
  if (activeProfile) {
    collection.replace(ENV_VAR_NAME, activeProfile.dirPath);
  }
}
```

- [ ] **Step 4: Create `src/quickPick.ts`**

```ts
// src/quickPick.ts
import * as vscode from 'vscode';
import type { ClaudeProfile } from './profileStore';

export type MainMenuResult =
  | { kind: 'switch'; profileId: string }
  | { kind: 'add' }
  | { kind: 'manage' }
  | undefined;

interface MenuItem extends vscode.QuickPickItem {
  action: MainMenuResult;
}

export async function showMainMenu(
  profiles: ClaudeProfile[],
  activeProfileId: string | undefined
): Promise<MainMenuResult> {
  const items: MenuItem[] = profiles.map((p) => ({
    label: p.id === activeProfileId ? `$(check) ${p.name}` : p.name,
    description: p.email ?? p.dirPath,
    action: { kind: 'switch', profileId: p.id },
  }));
  items.push({ label: '$(add) Them tai khoan moi...', action: { kind: 'add' } });
  items.push({ label: '$(gear) Quan ly profile...', action: { kind: 'manage' } });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Chon tai khoan Claude',
  });
  return picked?.action;
}

export type ManageMenuResult =
  | { kind: 'rename'; profileId: string }
  | { kind: 'remove'; profileId: string }
  | undefined;

interface ManageMenuItem extends vscode.QuickPickItem {
  action: ManageMenuResult;
}

export async function showManageMenu(profiles: ClaudeProfile[]): Promise<ManageMenuResult> {
  const items: ManageMenuItem[] = [];
  for (const p of profiles) {
    items.push({
      label: `$(edit) Doi ten "${p.name}"`,
      action: { kind: 'rename', profileId: p.id },
    });
    items.push({
      label: `$(trash) Xoa "${p.name}"`,
      action: { kind: 'remove', profileId: p.id },
    });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Quan ly profile',
  });
  return picked?.action;
}
```

- [ ] **Step 5: Create `src/addProfileFlow.ts`**

```ts
// src/addProfileFlow.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { addProfile, listProfiles } from './profileStore';
import type { ClaudeProfile } from './profileStore';
import { getProfilesJsonPath, getUniqueProfileDirPath } from './paths';
import { validateNewProfileName, waitForCredentialsFile } from './addProfileLogic';
import { readOAuthAccountCache } from './migration';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function isClaudeCliAvailable(): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export async function runAddProfileFlow(): Promise<ClaudeProfile | undefined> {
  if (!isClaudeCliAvailable()) {
    vscode.window.showErrorMessage(
      'Khong tim thay lenh "claude" trong PATH. Hay cai Claude Code CLI truoc (npm install -g @anthropic-ai/claude-code) roi thu lai.'
    );
    return undefined;
  }

  const profilesJsonPath = getProfilesJsonPath();
  const existing = listProfiles(profilesJsonPath);

  const name = await vscode.window.showInputBox({
    prompt: 'Ten goi nho cho tai khoan Claude moi',
    placeHolder: 'Work',
    validateInput: (value) => validateNewProfileName(value, existing),
  });
  if (!name) {
    return undefined;
  }

  const dirPath = getUniqueProfileDirPath(name);
  fs.mkdirSync(dirPath, { recursive: true });

  const terminal = vscode.window.createTerminal({
    name: `Claude Login: ${name}`,
    env: { CLAUDE_CONFIG_DIR: dirPath },
  });
  terminal.show();
  terminal.sendText('claude');

  const credentialsPath = path.join(dirPath, '.credentials.json');
  const loggedIn = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Dang cho dang nhap cho "${name}"...`,
      cancellable: false,
    },
    () => waitForCredentialsFile(credentialsPath, LOGIN_TIMEOUT_MS)
  );

  if (!loggedIn) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    vscode.window.showWarningMessage(
      `Khong phat hien dang nhap thanh cong cho "${name}" (qua 5 phut). Da huy.`
    );
    return undefined;
  }

  const cache = readOAuthAccountCache(dirPath);
  const profile = addProfile(profilesJsonPath, {
    name,
    dirPath,
    email: cache.email,
    organizationName: cache.organizationName,
  });
  vscode.window.showInformationMessage(`Da them tai khoan "${name}".`);
  return profile;
}
```

- [ ] **Step 6: Create `src/manageProfilesFlow.ts`**

```ts
// src/manageProfilesFlow.ts
import * as vscode from 'vscode';
import { findProfile, removeProfile, renameProfile, listProfiles } from './profileStore';
import { getProfilesJsonPath } from './paths';
import { validateNewProfileName } from './addProfileLogic';

export async function runRenameFlow(profileId: string): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return;
  }
  const others = listProfiles(profilesJsonPath).filter((p) => p.id !== profileId);
  const newName = await vscode.window.showInputBox({
    prompt: `Doi ten "${profile.name}" thanh:`,
    value: profile.name,
    validateInput: (value) => validateNewProfileName(value, others),
  });
  if (!newName || newName === profile.name) {
    return;
  }
  renameProfile(profilesJsonPath, profileId, newName);
  vscode.window.showInformationMessage(`Da doi ten thanh "${newName}".`);
}

export async function runRemoveFlow(profileId: string): Promise<{ removed: boolean }> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = findProfile(profilesJsonPath, profileId);
  if (!profile) {
    return { removed: false };
  }
  const confirm = await vscode.window.showWarningMessage(
    `Xoa profile "${profile.name}" khoi danh sach? (File credentials tren dia se duoc giu lai, khong bi xoa)`,
    { modal: true },
    'Xoa'
  );
  if (confirm !== 'Xoa') {
    return { removed: false };
  }
  removeProfile(profilesJsonPath, profileId);
  vscode.window.showInformationMessage(`Da xoa "${profile.name}" khoi danh sach.`);
  return { removed: true };
}
```

- [ ] **Step 7: Create `src/commands.ts`**

```ts
// src/commands.ts
import * as vscode from 'vscode';
import { getProfilesJsonPath } from './paths';
import { findProfile, listProfiles } from './profileStore';
import { getActiveProfileId, setActiveProfileId } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { refreshStatusBar } from './statusBar';
import { showMainMenu, showManageMenu } from './quickPick';
import { runAddProfileFlow } from './addProfileFlow';
import { runRenameFlow, runRemoveFlow } from './manageProfilesFlow';

let isBusy = false;

async function withBusyGuard(fn: () => Promise<void>): Promise<void> {
  if (isBusy) {
    return;
  }
  isBusy = true;
  try {
    await fn();
  } finally {
    isBusy = false;
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  const openMenu = vscode.commands.registerCommand('claudeProfileSwitcher.openMenu', () =>
    withBusyGuard(async () => {
      const profilesJsonPath = getProfilesJsonPath();
      const profiles = listProfiles(profilesJsonPath);
      const activeId = getActiveProfileId(context);
      const result = await showMainMenu(profiles, activeId);
      if (!result) {
        return;
      }
      if (result.kind === 'switch') {
        await switchToProfile(context, statusBarItem, result.profileId);
      } else if (result.kind === 'add') {
        const created = await runAddProfileFlow();
        if (created) {
          const switchNow = await vscode.window.showInformationMessage(
            `Chuyen sang "${created.name}" ngay bay gio?`,
            'Co',
            'De sau'
          );
          if (switchNow === 'Co') {
            await switchToProfile(context, statusBarItem, created.id);
          }
        }
      } else if (result.kind === 'manage') {
        await handleManageMenu(context, statusBarItem);
      }
    })
  );

  context.subscriptions.push(openMenu);
}

async function handleManageMenu(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profiles = listProfiles(profilesJsonPath);
  const result = await showManageMenu(profiles);
  if (!result) {
    return;
  }
  if (result.kind === 'rename') {
    await runRenameFlow(result.profileId);
    refreshActiveDisplay(context, statusBarItem);
  } else if (result.kind === 'remove') {
    const activeId = getActiveProfileId(context);
    const { removed } = await runRemoveFlow(result.profileId);
    if (removed && result.profileId === activeId) {
      const remaining = listProfiles(profilesJsonPath);
      await switchToProfile(context, statusBarItem, remaining[0]?.id);
    } else {
      refreshActiveDisplay(context, statusBarItem);
    }
  }
}

export async function switchToProfile(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  profileId: string | undefined
): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();
  const profile = profileId ? findProfile(profilesJsonPath, profileId) : undefined;

  applyProfileEnvironment(profile);
  applyEnvironmentVariableCollection(context, profile);
  await setActiveProfileId(context, profile?.id);
  refreshStatusBar(statusBarItem, profile);

  if (profile) {
    try {
      await vscode.commands.executeCommand('claude-vscode.newConversation');
    } catch {
      // Extension chinh thuc co the doi id lenh; switch env van thanh cong.
    }
    vscode.window.showInformationMessage(
      `Da chuyen sang "${profile.name}". Da mo conversation moi dung tai khoan nay.`
    );
  }
}

function refreshActiveDisplay(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  const profilesJsonPath = getProfilesJsonPath();
  const activeId = getActiveProfileId(context);
  const profile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;
  refreshStatusBar(statusBarItem, profile);
}
```

- [ ] **Step 8: Replace `src/extension.ts` stub with full activation logic**

```ts
// src/extension.ts
import * as vscode from 'vscode';
import { getProfilesJsonPath } from './paths';
import { findProfile } from './profileStore';
import { tryFirstRunMigration } from './migration';
import { getActiveProfileId, setActiveProfileId } from './activeProfileState';
import { applyProfileEnvironment } from './envApply';
import { applyEnvironmentVariableCollection } from './envCollection';
import { createStatusBarItem, refreshStatusBar } from './statusBar';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const profilesJsonPath = getProfilesJsonPath();

  const activeId = getActiveProfileId(context);
  let activeProfile = activeId ? findProfile(profilesJsonPath, activeId) : undefined;

  if (!activeProfile) {
    const migrated = tryFirstRunMigration(profilesJsonPath);
    if (migrated) {
      await setActiveProfileId(context, migrated.id);
      activeProfile = migrated;
    }
  }

  applyProfileEnvironment(activeProfile);
  applyEnvironmentVariableCollection(context, activeProfile);

  const statusBarItem = createStatusBarItem('claudeProfileSwitcher.openMenu');
  refreshStatusBar(statusBarItem, activeProfile);
  context.subscriptions.push(statusBarItem);

  registerCommands(context, statusBarItem);
}

export function deactivate(): void {}
```

- [ ] **Step 9: Compile**

Run: `npm run compile`
Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 10: Manual smoke test**

Press `F5` in VSCode (with this project open) to launch an Extension Development Host
window, then run through the checklist from spec section 9:

1. First-run migration: with an existing `~/.claude` login, confirm the status bar
   shows `Claude: Default` on first activation.
2. Click the status bar item → "Them tai khoan moi..." → enter a name → confirm a
   terminal opens running `claude`, complete login in the browser → confirm the new
   profile appears in the menu with the correct cached email.
3. Switch to the new profile → confirm a new conversation opens in the chat panel
   using that account (check via `/status` in chat or the account indicator the
   official extension shows).
4. Open a second VSCode window (File > New Window), switch it to a different
   profile → confirm the two windows use different accounts independently.
5. Create two VSCode Profiles (Work/Personal), bind each to a different Claude
   profile, close and reopen each VSCode Profile → confirm each remembers its own
   Claude profile.
6. Open a new integrated terminal → run `echo %CLAUDE_CONFIG_DIR%` → confirm it
   matches the active profile's directory.
7. Rename a profile, then remove a profile (including removing the currently active
   one) → confirm fallback behavior matches spec section 5.6.

- [ ] **Step 11: Commit**

```bash
git add src/activeProfileState.ts src/statusBar.ts src/envCollection.ts src/quickPick.ts src/addProfileFlow.ts src/manageProfilesFlow.ts src/commands.ts src/extension.ts
git commit -m "feat: wire profile switching into VSCode extension host

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: README and local packaging

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Claude Profile Switcher

VSCode extension de chuyen doi nhanh giua nhieu tai khoan Claude Code da dang nhap,
khong can dang nhap lai.

## Cach dung

1. Bam vao status bar item `Claude: ...` o goc duoi ben trai.
2. Chon "Them tai khoan moi..." de dang nhap them mot tai khoan (mo terminal chay
   `claude`, hoan tat OAuth login qua trinh duyet nhu binh thuong).
3. Chon mot profile co san trong danh sach de switch — chat panel "Claude Code" se
   tu dong mo conversation moi dung tai khoan vua chon.
4. Mo nhieu cua so VSCode, moi cua so switch sang mot profile khac nhau de chay
   song song nhieu tai khoan.
5. Dung VSCode Profiles (Work/Personal/...) de moi Profile tu nho rieng mot tai
   khoan Claude.

## Build & cai dat local

```bash
npm install
npm run compile
npm run package        # tao file .vsix
code --install-extension claude-profile-switcher-0.1.0.vsix
```

## Development

```bash
npm test                # chay unit test (node:test) cho cac module logic thuan
npm run watch            # tsc watch mode
```

Nhan `F5` trong VSCode (mo project nay) de launch Extension Development Host va
test truc tiep.

Xem chi tiet thiet ke tai `docs/superpowers/specs/2026-08-20-claude-profile-switcher-design.md`.
```

- [ ] **Step 2: Package to .vsix**

Run: `npm run package`
Expected: creates `claude-profile-switcher-0.1.0.vsix` in the project root, exits
with code 0. (`vsce` may print warnings about the missing marketplace `repository`
field — safe to ignore for local-only use, per spec section 10.)

- [ ] **Step 3: Install locally and verify**

Run: `code --install-extension claude-profile-switcher-0.1.0.vsix`
Expected: "Extension 'claude-profile-switcher' was successfully installed." Restart
VSCode normally (not the Extension Development Host) and confirm the status bar
item appears.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add usage README and local packaging instructions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
