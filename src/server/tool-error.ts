/**
 * Shared error handling for MCP tools: consistent logging and user-facing messages.
 */

import { getLogLevel, error as logError } from '../logger.js';

/** User-facing error message: detailed in DEBUG, generic otherwise. */
export function getToolErrorMessage(error: unknown, fallbackMessage: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  return getLogLevel() === 'DEBUG' ? msg : fallbackMessage;
}

/** Log tool failure to stderr via the level-based logger. */
export function logToolError(toolName: string, error: unknown): void {
  logError(`Error in ${toolName} tool`, error);
}
