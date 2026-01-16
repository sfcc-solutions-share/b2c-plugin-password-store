/**
 * B2C CLI plugin for password-store (pass) credential storage.
 *
 * This plugin provides a ConfigSource that reads B2C credentials
 * from the password-store using the `pass` command-line tool.
 *
 * ## Installation
 *
 * ```bash
 * b2c plugins install sfcc-solutions-share/b2c-plugin-password-store
 * ```
 *
 * ## Usage
 *
 * Store credentials in pass:
 *
 * ```bash
 * # Global/shared credentials
 * pass insert b2c-cli/_default
 * # Enter:
 * #   (empty line or shared password)
 * #   client-id: my-oauth-client
 * #   client-secret: my-oauth-secret
 *
 * # Instance-specific credentials
 * pass insert b2c-cli/staging
 * # Enter:
 * #   my-webdav-api-key
 * #   username: user@example.com
 * #   hostname: dev01.example.com
 * ```
 *
 * Then use the CLI with the instance flag:
 *
 * ```bash
 * b2c code deploy --instance staging
 * ```
 *
 * @module b2c-plugin-password-store
 */

export {PassSource} from './sources/pass-source.js';
export type {ConfigSource, NormalizedConfig, ResolveConfigOptions} from './types.js';
