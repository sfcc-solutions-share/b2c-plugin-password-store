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

/** Entry name for MRT credentials */
const MOBIFY_ENTRY = '_mobify';

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
  'mrt-origin': 'mrtOrigin',
};

/**
 * Configuration source that reads credentials from password-store.
 *
 * Credentials are stored in pass using the standard multi-line format:
 * - First line: WebDAV password/API key (optional)
 * - Additional lines: `key: value` pairs
 *
 * Entry structure:
 * - `b2c-cli/_default` - Base global defaults
 * - `b2c-cli/_default/<account-manager-host>` - Host-specific OAuth defaults
 * - `b2c-cli/_mobify` - Base MRT credentials
 * - `b2c-cli/_mobify/<cloud-origin-hostname>` - Cloud-origin-specific MRT credentials
 * - `b2c-cli/<instance>` - Instance-specific credentials
 *
 * @example
 * ```bash
 * # Store global defaults (shared OAuth credentials)
 * pass insert -m b2c-cli/_default
 * # Enter:
 * # client-id: my-oauth-client
 * # client-secret: my-oauth-secret
 *
 * # Store host-specific OAuth (for specific account manager)
 * pass insert -m b2c-cli/_default/account-pod5.demandware.net
 * # Enter:
 * # client-id: pod5-client
 * # client-secret: pod5-secret
 *
 * # Store MRT credentials
 * pass insert -m b2c-cli/_mobify
 * # Enter:
 * # mrt-api-key: my-api-key
 *
 * # Store instance-specific credentials
 * pass insert -m b2c-cli/staging
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
   * 2. Load base _default
   * 3. If accountManagerHost provided, load _default/{accountManagerHost}
   * 4. Load instance config
   * 5. Load MRT config (_mobify with optional cloud-origin)
   * 6. Merge in order: _default → _default/{host} → _mobify → instance
   *
   * @param options - Resolution options including instance, accountManagerHost, cloudOrigin
   * @returns Config and location, or undefined if not available
   */
  load(options: ResolveConfigOptions): ConfigLoadResult | undefined {
    // Check if pass is available
    if (!isPassAvailable()) {
      return undefined;
    }

    const locationParts: string[] = [];

    // Step 1: Load base _default
    const baseDefault = this.loadEntry(`${this.prefix}/${DEFAULT_ENTRY}`, locationParts);

    // Step 2: Load host-specific default if accountManagerHost provided
    let hostDefault: NormalizedConfig | undefined;
    if (options.accountManagerHost) {
      hostDefault = this.loadEntry(
        `${this.prefix}/${DEFAULT_ENTRY}/${options.accountManagerHost}`,
        locationParts,
      );
    }

    // Step 3: Load instance config
    const instance = options.instance ?? process.env[ENV_INSTANCE];
    let instanceConfig: NormalizedConfig | undefined;
    if (instance) {
      instanceConfig = this.loadEntry(`${this.prefix}/${instance}`, locationParts);
    }

    // Step 4: Load MRT config (_mobify with optional cloud-origin)
    const mrtConfig = this.loadMrtConfig(options, locationParts);

    // If no config loaded from any source, return undefined
    if (locationParts.length === 0) {
      return undefined;
    }

    // Step 5: Merge in order: _default → _default/{host} → _mobify → instance
    const merged: NormalizedConfig = {
      ...baseDefault,
      ...hostDefault,
      ...mrtConfig,
      ...instanceConfig,
    };

    return {
      config: merged,
      location: locationParts.join(','),
    };
  }

  /**
   * Load an entry from pass and map it to NormalizedConfig.
   *
   * @param path - Full path to the pass entry
   * @param locationParts - Array to append location info to (for diagnostics)
   * @returns NormalizedConfig or undefined if entry doesn't exist
   */
  private loadEntry(path: string, locationParts: string[]): NormalizedConfig | undefined {
    const entry = getConfigFromPass(path);
    if (entry) {
      locationParts.push(`pass:${path}`);
      return this.mapToNormalizedConfig(entry);
    }
    return undefined;
  }

  /**
   * Load MRT config from _mobify entries.
   *
   * Tries cloud-origin-specific entry first, falls back to base _mobify.
   *
   * @param options - Resolution options with optional cloudOrigin
   * @param locationParts - Array to append location info to
   * @returns NormalizedConfig or undefined if no MRT config found
   */
  private loadMrtConfig(
    options: ResolveConfigOptions,
    locationParts: string[],
  ): NormalizedConfig | undefined {
    // Try cloud-origin-specific first
    if (options.cloudOrigin) {
      try {
        const hostname = new URL(options.cloudOrigin).hostname;
        const hostSpecific = this.loadEntry(
          `${this.prefix}/${MOBIFY_ENTRY}/${hostname}`,
          locationParts,
        );
        if (hostSpecific) return hostSpecific;
      } catch {
        // Invalid URL, skip host-specific lookup
      }
    }

    // Fall back to base _mobify
    return this.loadEntry(`${this.prefix}/${MOBIFY_ENTRY}`, locationParts);
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
