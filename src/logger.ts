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

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatMessage(level: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (data !== undefined) {
    return `${prefix} ${msg} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${msg}`;
}

export function debug(msg: string, data?: unknown): void {
  if (shouldLog('DEBUG')) {
    console.error(formatMessage('DEBUG', msg, data));
  }
}

export function info(msg: string, data?: unknown): void {
  if (shouldLog('INFO')) {
    console.error(formatMessage('INFO', msg, data));
  }
}

export function warn(msg: string, data?: unknown): void {
  if (shouldLog('WARN')) {
    console.error(formatMessage('WARN', msg, data));
  }
}

export function error(msg: string, err?: unknown): void {
  if (shouldLog('ERROR')) {
    const detail = err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
    console.error(formatMessage('ERROR', msg, detail !== undefined ? { error: detail } : undefined));
  }
}
