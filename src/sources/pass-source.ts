/**
 * password-store (pass) configuration source.
 *
 * Loads B2C CLI credentials from the password-store using the
 * `pass` command-line tool.
 *
 * @module sources/pass-source
 */

// TODO: Import from @salesforce/b2c-tooling-sdk/config once published to npm
import type {ConfigSource, ConfigLoadResult, NormalizedConfig, ResolveConfigOptions} from '../types.js';
import {getConfigFromPass, isPassAvailable, type ParsedPassEntry} from './pass.js';

/** Default prefix for pass entries */
const DEFAULT_PREFIX = 'b2c-cli';

/** Entry name for global defaults */
const DEFAULT_ENTRY = '_default';

/** Environment variable for prefix override */
const ENV_PREFIX = 'SFCC_PASS_PREFIX';

/** Environment variable for fallback instance */
const ENV_INSTANCE = 'SFCC_PASS_INSTANCE';

/**
 * Field mapping from pass entry keys to NormalizedConfig fields.
 * Keys are lowercase for case-insensitive matching.
 */
const FIELD_MAP: Record<string, keyof NormalizedConfig> = {
  'username': 'username',
  'password': 'password',
  'hostname': 'hostname',
  'webdav-hostname': 'webdavHostname',
  'code-version': 'codeVersion',
  'client-id': 'clientId',
  'client-secret': 'clientSecret',
  'scopes': 'scopes',
  'short-code': 'shortCode',
  'account-manager-host': 'accountManagerHost',
  'mrt-project': 'mrtProject',
  'mrt-environment': 'mrtEnvironment',
  'mrt-api-key': 'mrtApiKey',
};

/**
 * Configuration source that reads credentials from password-store.
 *
 * Credentials are stored in pass using the standard multi-line format:
 * - First line: WebDAV password/API key
 * - Additional lines: `key: value` pairs
 *
 * Entry structure:
 * - `b2c-cli/_default` for global/shared credentials
 * - `b2c-cli/<instance>` for instance-specific credentials
 *
 * @example
 * ```bash
 * # Store global defaults (shared OAuth credentials)
 * pass insert b2c-cli/_default
 * # Enter:
 * # <empty or global password>
 * # client-id: my-oauth-client
 * # client-secret: my-oauth-secret
 *
 * # Store instance-specific credentials
 * pass insert b2c-cli/staging
 * # Enter:
 * # my-webdav-api-key
 * # username: user@example.com
 * # hostname: dev01.example.com
 * ```
 */
export class PassSource implements ConfigSource {
  readonly name = 'password-store';

  private prefix: string;

  constructor() {
    this.prefix = process.env[ENV_PREFIX] ?? DEFAULT_PREFIX;
  }

  /**
   * Load credentials from the password-store.
   *
   * Resolution flow:
   * 1. Check if pass is available
   * 2. Load global defaults from `b2c-cli/_default` (if exists)
   * 3. Determine instance: options.instance → SFCC_PASS_INSTANCE
   * 4. If instance determined, load and merge with global (instance overrides)
   * 5. Return merged config
   *
   * @param options - Resolution options including instance selection
   * @returns Config and location, or undefined if not available
   */
  load(options: ResolveConfigOptions): ConfigLoadResult | undefined {
    // Check if pass is available
    if (!isPassAvailable()) {
      return undefined;
    }

    const locationParts: string[] = [];

    // Step 1: Load global defaults from _default entry
    const globalPath = `${this.prefix}/${DEFAULT_ENTRY}`;
    const globalEntry = getConfigFromPass(globalPath);
    let globalConfig: NormalizedConfig | undefined;

    if (globalEntry) {
      globalConfig = this.mapToNormalizedConfig(globalEntry);
      locationParts.push(`pass:${globalPath}`);
    }

    // Step 2: Determine instance (flag → env var)
    const instance = options.instance ?? process.env[ENV_INSTANCE];

    // Step 3: Load instance-specific config if we have an instance
    let instanceConfig: NormalizedConfig | undefined;

    if (instance) {
      const instancePath = `${this.prefix}/${instance}`;
      const instanceEntry = getConfigFromPass(instancePath);

      if (instanceEntry) {
        instanceConfig = this.mapToNormalizedConfig(instanceEntry);
        locationParts.push(`pass:${instancePath}`);
      }
    }

    // If neither global nor instance config exists, return undefined
    if (!globalConfig && !instanceConfig) {
      return undefined;
    }

    // Step 4: Merge configs (instance overrides global)
    const merged: NormalizedConfig = {
      ...globalConfig,
      ...instanceConfig,
    };

    return {
      config: merged,
      location: locationParts.join(','),
    };
  }

  /**
   * Map a parsed pass entry to NormalizedConfig.
   *
   * @param entry - Parsed pass entry
   * @returns NormalizedConfig object
   */
  private mapToNormalizedConfig(entry: ParsedPassEntry): NormalizedConfig {
    const config: NormalizedConfig = {};

    // First line (_password) maps to the password field
    if (entry._password) {
      config.password = entry._password;
    }

    // Map other fields using the field map
    for (const [key, value] of Object.entries(entry)) {
      if (key === '_password' || value === undefined) {
        continue;
      }

      // Case-insensitive key matching
      const normalizedKey = key.toLowerCase();
      const configKey = FIELD_MAP[normalizedKey];

      if (configKey) {
        if (configKey === 'scopes') {
          // Parse comma-separated scopes into array
          config.scopes = value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          // Direct string assignment
          (config as Record<string, string>)[configKey] = value;
        }
      }
    }

    return config;
  }
}
