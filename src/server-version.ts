/**
 * MCP server version — read from package.json next to the compiled output.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SERVER_VERSION = '0.0.1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

/**
 * Read `version` from package.json text (same rules as the live server).
 * On invalid JSON, missing `version`, or invalid type, writes to stderr and returns {@link DEFAULT_SERVER_VERSION}.
 */
export function parsePackageJsonVersion(raw: string, pathForErrors = 'package.json'): string {
  try {
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version !== 'string') {
      console.error(
        `[server-version] invalid or missing "version" in ${pathForErrors}; using default ${DEFAULT_SERVER_VERSION}`
      );
      return DEFAULT_SERVER_VERSION;
    }
    const version = parsed.version.trim();
    if (version.length === 0) {
      console.error(
        `[server-version] empty "version" in ${pathForErrors}; using default ${DEFAULT_SERVER_VERSION}`
      );
      return DEFAULT_SERVER_VERSION;
    }
    return version;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `[server-version] could not parse ${pathForErrors} (${detail}); using default ${DEFAULT_SERVER_VERSION}`
    );
    return DEFAULT_SERVER_VERSION;
  }
}

/**
 * Resolve the MCP server version from the package manifest on disk (by default,
 * `package.json` one directory above this module).
 *
 * @param overridePath - For tests; otherwise the repo root `package.json` next to compiled output.
 */
export function resolveServerVersion(overridePath?: string): string {
  const packagePath = overridePath ?? packageJsonPath;
  if (!existsSync(packagePath)) {
    console.error(
      `[server-version] package.json not found at ${packagePath}; using default ${DEFAULT_SERVER_VERSION}`
    );
    return DEFAULT_SERVER_VERSION;
  }
  try {
    const raw = readFileSync(packagePath, 'utf8');
    return parsePackageJsonVersion(raw, packagePath);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `[server-version] could not read ${packagePath} (${detail}); using default ${DEFAULT_SERVER_VERSION}`
    );
    return DEFAULT_SERVER_VERSION;
  }
}

export const SERVER_VERSION = resolveServerVersion();
