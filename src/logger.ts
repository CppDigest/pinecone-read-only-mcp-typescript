/**
 * Simple level-based logger for the MCP server.
 * Logs to stderr; never logs secrets. Use for deploy/observability.
 */

import type { LogLevel } from './config.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = 'INFO';

/** Set the minimum log level (DEBUG, INFO, WARN, ERROR). Messages below this level are dropped. */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Return the current minimum log level. */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/** True if the given level is at or above the current minimum. */
function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

/** Format a single log line: timestamp, level, message, and optional JSON data. */
function formatMessage(level: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (data !== undefined) {
    return `${prefix} ${msg} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${msg}`;
}

/** Log a DEBUG-level message to stderr when the log level allows. */
export function debug(msg: string, data?: unknown): void {
  if (shouldLog('DEBUG')) {
    console.error(formatMessage('DEBUG', msg, data));
  }
}

/** Log an INFO-level message to stderr when the log level allows. */
export function info(msg: string, data?: unknown): void {
  if (shouldLog('INFO')) {
    console.error(formatMessage('INFO', msg, data));
  }
}

/** Log a WARN-level message to stderr when the log level allows. */
export function warn(msg: string, data?: unknown): void {
  if (shouldLog('WARN')) {
    console.error(formatMessage('WARN', msg, data));
  }
}

/** Log an ERROR-level message to stderr with optional error (message and stack). */
export function error(msg: string, err?: unknown): void {
  if (shouldLog('ERROR')) {
    // const detail = err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
    // console.error(
    //   formatMessage('ERROR', msg, detail !== undefined ? { error: detail } : undefined)
    // );
    const detail =
      err instanceof Error
        ? { message: err.message, stack: err.stack }
        : err !== undefined
          ? String(err)
          : undefined;
    console.error(
      formatMessage('ERROR', msg, detail !== undefined ? { error: detail } : undefined)
    );
  }
}
