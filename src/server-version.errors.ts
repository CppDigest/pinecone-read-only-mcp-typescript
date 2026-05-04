/**
 * Errors for reading the MCP server version from package manifest JSON.
 */

export const PACKAGE_JSON_VERSION_ERROR_CODE = 'PACKAGE_JSON_INVALID_VERSION' as const;

/** Thrown when package.json (or similar) has no usable `"version"` string. */
export class PackageJsonVersionError extends Error {
  override readonly name = 'PackageJsonVersionError';
  readonly code = PACKAGE_JSON_VERSION_ERROR_CODE;

  constructor(
    /** Path or label shown in diagnostics (e.g. package.json path). */
    readonly packageJsonPath: string,
    message: string
  ) {
    super(message);
  }
}

/** `"version"` is missing or not a string. */
export function throwInvalidVersionFieldType(packageJsonPath: string): never {
  throw new PackageJsonVersionError(
    packageJsonPath,
    `Expected "version" to be a non-empty string in ${packageJsonPath}`
  );
}

/** `"version"` is a string but empty or whitespace-only after trim. */
export function throwInvalidVersionWhitespaceOnly(packageJsonPath: string): never {
  throw new PackageJsonVersionError(
    packageJsonPath,
    `Expected "version" to contain non-whitespace characters in ${packageJsonPath}`
  );
}

export const PACKAGE_JSON_NOT_FOUND_ERROR_CODE = 'PACKAGE_JSON_NOT_FOUND' as const;

/** Thrown when the expected package manifest file does not exist on disk. */
export class PackageJsonNotFoundError extends Error {
  override readonly name = 'PackageJsonNotFoundError';
  readonly code = PACKAGE_JSON_NOT_FOUND_ERROR_CODE;

  constructor(
    /** Absolute or relative path that was checked. */
    readonly packageJsonPath: string,
    message: string
  ) {
    super(message);
  }
}

export function throwPackageJsonNotFound(packageJsonPath: string): never {
  throw new PackageJsonNotFoundError(
    packageJsonPath,
    `No package manifest found at ${packageJsonPath}`
  );
}
