/**
 * MCP server version — always matches the root package.json "version" field.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

/**
 * Read `version` from package.json text (same rules as the live server).
 */
export function parsePackageJsonVersion(raw: string, pathForErrors = 'package.json'): string {
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(`Invalid or missing "version" in ${pathForErrors}`);
  }
  return parsed.version;
}

const raw = readFileSync(packageJsonPath, 'utf8');
export const SERVER_VERSION = parsePackageJsonVersion(raw, packageJsonPath);
