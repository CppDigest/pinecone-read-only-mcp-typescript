import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parsePackageJsonVersion, resolveServerVersion, SERVER_VERSION } from './server-version.js';

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

  it('trims surrounding whitespace on version', () => {
    expect(parsePackageJsonVersion(JSON.stringify({ version: '  1.2.3  ' }))).toBe('1.2.3');
  });

  it('returns default when version is only whitespace', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(parsePackageJsonVersion(JSON.stringify({ version: '   ' }))).toBe('0.0.1');
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('returns default when version is not a string', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(parsePackageJsonVersion(JSON.stringify({ version: 1 }))).toBe('0.0.1');
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
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

describe('resolveServerVersion', () => {
  it('returns default version when package manifest path does not exist', () => {
    const missing = join(tmpdir(), `no-package-json-${Date.now()}.json`);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(resolveServerVersion(missing)).toBe('0.0.1');
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('returns default version when path is missing even if npm_package_version is set', () => {
    const missing = join(tmpdir(), `no-package-json-env-${Date.now()}.json`);
    const prev = process.env.npm_package_version;
    process.env.npm_package_version = '9.9.9-test';
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(resolveServerVersion(missing)).toBe('0.0.1');
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
      if (prev !== undefined) process.env.npm_package_version = prev;
      else delete process.env.npm_package_version;
    }
  });
});
