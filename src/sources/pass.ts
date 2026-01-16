/**
 * password-store (pass) CLI wrapper.
 *
 * Provides functions to read entries from the password-store
 * using the `pass` command-line tool.
 *
 * @module sources/pass
 */

import {execSync} from 'node:child_process';

/**
 * Parsed pass entry with key-value pairs.
 * The special `_password` key holds the first line (main password).
 */
export interface ParsedPassEntry {
  /** First line of the entry (the main password/secret) */
  _password?: string;
  /** Additional key-value fields from subsequent lines */
  [key: string]: string | undefined;
}

/**
 * Check if the pass command is available.
 *
 * @returns true if pass is installed and accessible
 */
export function isPassAvailable(): boolean {
  try {
    execSync('which pass', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves an entry from the password-store.
 *
 * Uses `pass show <path>` to retrieve the entry contents.
 *
 * @param path - The path to the entry (e.g., 'b2c-cli/staging')
 * @returns The raw entry contents, or undefined if not found
 *
 * @example
 * ```typescript
 * const content = getEntry('b2c-cli/staging');
 * if (content) {
 *   const parsed = parsePassEntry(content);
 * }
 * ```
 */
export function getEntry(path: string): string | undefined {
  try {
    const result = execSync(`pass show '${escapeShellArg(path)}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch {
    // Command exits with non-zero if entry not found
    return undefined;
  }
}

/**
 * Parses a pass entry in the standard multi-line format.
 *
 * Format:
 * - First line: the main password (stored in `_password`)
 * - Subsequent lines: `key: value` pairs
 *
 * @param content - The raw entry content from pass
 * @returns Parsed key-value object
 *
 * @example
 * ```typescript
 * const content = `my-api-key
 * username: user@example.com
 * hostname: dev01.example.com`;
 *
 * const parsed = parsePassEntry(content);
 * // {
 * //   _password: 'my-api-key',
 * //   username: 'user@example.com',
 * //   hostname: 'dev01.example.com'
 * // }
 * ```
 */
export function parsePassEntry(content: string): ParsedPassEntry {
  const lines = content.split('\n');
  const result: ParsedPassEntry = {};

  // First non-empty line is the password
  let foundPassword = false;
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines before the password
    if (!foundPassword) {
      if (trimmed) {
        result._password = trimmed;
        foundPassword = true;
      }
      continue;
    }

    // Parse key: value lines
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Retrieves and parses an entry from the password-store.
 *
 * @param path - The path to the entry (e.g., 'b2c-cli/staging')
 * @returns Parsed entry, or undefined if not found
 */
export function getConfigFromPass(path: string): ParsedPassEntry | undefined {
  const content = getEntry(path);
  if (!content) {
    return undefined;
  }
  return parsePassEntry(content);
}

/**
 * Escapes a string for safe use in shell single quotes.
 * Replaces single quotes with escaped version.
 */
function escapeShellArg(arg: string): string {
  // In single quotes, only single quote needs escaping: ' -> '\''
  return arg.replace(/'/g, "'\\''");
}
