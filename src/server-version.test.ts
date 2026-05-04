import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePackageJsonVersion, SERVER_VERSION } from './server-version.js';

function readRootPackageJson(): string {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  return readFileSync(packageJsonPath, 'utf8');
}

/**
 * True when the server-reported version matches the package.json version.
 * Returns false when the two strings differ (stale hardcoding or wrong file).
 */
function isServerVersionAligned(serverVersion: string, packageVersion: string): boolean {
  return serverVersion === packageVersion;
}

/** Synthetic package.json bodies — only the `version` field matters for parsing. */
const PACKAGE_JSON_FIXTURES: readonly string[] = [
  JSON.stringify({ name: 'a', version: '0.1.0' }),
  JSON.stringify({ name: 'b', version: '1.0.0' }),
  JSON.stringify({ version: '0.1.6', type: 'module' }),
  JSON.stringify({ version: '2.3.4', private: true }),
];

describe('parsePackageJsonVersion', () => {
  it('extracts version from several package.json shapes', () => {
    expect(parsePackageJsonVersion(PACKAGE_JSON_FIXTURES[0])).toBe('0.1.0');
    expect(parsePackageJsonVersion(PACKAGE_JSON_FIXTURES[1])).toBe('1.0.0');
    expect(parsePackageJsonVersion(PACKAGE_JSON_FIXTURES[2])).toBe('0.1.6');
    expect(parsePackageJsonVersion(PACKAGE_JSON_FIXTURES[3])).toBe('2.3.4');
  });
});

describe('isServerVersionAligned', () => {
  it('returns true when server and package versions are the same string', () => {
    for (const raw of PACKAGE_JSON_FIXTURES) {
      const v = parsePackageJsonVersion(raw);
      expect(isServerVersionAligned(v, v)).toBe(true);
    }
  });

  it('returns false when server and package versions differ', () => {
    expect(isServerVersionAligned('0.1.0', '0.2.0')).toBe(false);
    expect(isServerVersionAligned('1.0.0', '2.0.0')).toBe(false);
  });
});

describe('SERVER_VERSION', () => {
  it('matches the root package.json version (live module read)', () => {
    const packageVersion = parsePackageJsonVersion(readRootPackageJson());
    expect(isServerVersionAligned(SERVER_VERSION, packageVersion)).toBe(true);
    expect(SERVER_VERSION).toBe(packageVersion);
  });
});
