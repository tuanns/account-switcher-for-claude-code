import * as fs from 'fs';
import * as path from 'path';

type McpServerMap = Record<string, unknown>;

function readJsonObject(filePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Reads the `mcpServers` key nested inside a real `.claude.json`. */
function readMcpServers(claudeJsonPath: string): McpServerMap {
  const mcpServers = readJsonObject(claudeJsonPath).mcpServers;
  return mcpServers && typeof mcpServers === 'object' ? (mcpServers as McpServerMap) : {};
}

/**
 * Reads the canonical shared registry — unlike a real `.claude.json`, this
 * file's top level directly *is* the server map (no `mcpServers` wrapper
 * key), since it isn't itself a Claude Code config file.
 */
function readSharedMcpServers(sharedJsonPath: string): McpServerMap {
  return readJsonObject(sharedJsonPath) as McpServerMap;
}

/**
 * Merges `local` on top of `shared` — every key `local` defines wins,
 * everything else from `shared` is kept as-is. Exported (rather than
 * folded into `syncMcpServers`) so the merge policy itself has a direct
 * unit test independent of the filesystem.
 */
export function mergeMcpServers(shared: McpServerMap, local: McpServerMap): McpServerMap {
  return { ...shared, ...local };
}

/**
 * Two-way syncs `<claudeJsonPath>`'s `mcpServers` with the canonical shared
 * map at `sharedJsonPath`.
 *
 * Unlike `projects`/`plugins`/`skills` (see `sharedDirs.ts`), `mcpServers`
 * lives inside each profile's own `.claude.json` *file*, not a subdirectory
 * — there's no directory to junction away, so keeping every profile's view
 * in sync needs an actual merge instead of a symlink. This does that in two
 * steps, every time it's called (from `extension.ts` on every activation,
 * and from the explicit switch commands in `commands.ts`):
 *
 * 1. Whatever this profile currently has locally is merged INTO the shared
 *    map (adding new servers, and overwriting the shared copy of any this
 *    profile also defines — the most recently active profile's version
 *    wins per-server-name).
 * 2. The (now-updated) full shared map is written back into this profile's
 *    own `.claude.json`.
 *
 * Repeated over successive activations across different profiles/windows,
 * every profile converges to the same superset of servers — a server added
 * under any one profile eventually appears under all of them — without
 * ever silently dropping one a user added somewhere else.
 *
 * No-ops if `claudeJsonPath` doesn't exist yet (Claude Code CLI itself has
 * never run there, so there's no real `.claude.json` structure to safely
 * merge into — the next activation after it exists picks the sync up) or
 * if there's nothing to sync in either direction yet.
 */
export function syncMcpServers(claudeJsonPath: string, sharedJsonPath: string): void {
  const local = readMcpServers(claudeJsonPath);
  const shared = readSharedMcpServers(sharedJsonPath);
  const merged = mergeMcpServers(shared, local);

  if (Object.keys(merged).length === 0) {
    return;
  }

  fs.mkdirSync(path.dirname(sharedJsonPath), { recursive: true });
  fs.writeFileSync(sharedJsonPath, JSON.stringify(merged, null, 2), 'utf8');

  if (!fs.existsSync(claudeJsonPath)) {
    return;
  }
  const parsed = readJsonObject(claudeJsonPath);
  parsed.mcpServers = merged;
  fs.writeFileSync(claudeJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
}
