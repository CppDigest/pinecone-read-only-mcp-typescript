/**
 * MCP server version — read from package.json next to the compiled output.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  throwInvalidVersionFieldType,
  throwInvalidVersionWhitespaceOnly,
  throwPackageJsonNotFound,
} from './server-version.errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

/**
 * Read `version` from package.json text (same rules as the live server).
 */
export function parsePackageJsonVersion(raw: string, pathForErrors = 'package.json'): string {
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== 'string') {
    throwInvalidVersionFieldType(pathForErrors);
  }
  const version = parsed.version.trim();
  if (version.length === 0) {
    throwInvalidVersionWhitespaceOnly(pathForErrors);
  }
  return version;
}

/**
 * Resolve the MCP server version from the package manifest on disk (by default,
 * `package.json` one directory above this module).
 *
 * @param overridePath - For tests; otherwise the repo root `package.json` next to compiled output.
 * @throws PackageJsonNotFoundError if the manifest path does not exist.
 * @throws PackageJsonVersionError if `"version"` is missing or invalid.
 * @throws SyntaxError if the file is not valid JSON.
 */
export function resolveServerVersion(overridePath?: string): string {
  const packagePath = overridePath ?? packageJsonPath;
  if (!existsSync(packagePath)) {
    throwPackageJsonNotFound(packagePath);
  }
  const raw = readFileSync(packagePath, 'utf8');
  return parsePackageJsonVersion(raw, packagePath);
}

export const SERVER_VERSION = resolveServerVersion();
