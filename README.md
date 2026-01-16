# b2c-plugin-password-store

A plugin for the [B2C CLI](https://github.com/SalesforceCommerceCloud/b2c-developer-tooling) that loads credentials from [password-store](https://www.passwordstore.org/) (pass).

This allows you to securely store B2C credentials using GPG encryption without keeping them in files like `dw.json` or environment variables.

## Prerequisites

- [B2C CLI](https://github.com/SalesforceCommerceCloud/b2c-developer-tooling) installed
- [pass](https://www.passwordstore.org/) installed and initialized with a GPG key

## Installation

Install directly from GitHub:

```bash
b2c plugins install sfcc-solutions-share/b2c-plugin-password-store

# Verify installation
b2c plugins
```

### Development Installation

For local development:

```bash
# Clone the repository
git clone https://github.com/sfcc-solutions-share/b2c-plugin-password-store.git
cd b2c-plugin-password-store

# Install dependencies and build
npm install
npm run build

# Link to B2C CLI
b2c plugins link .

# Verify installation
b2c plugins
```

## Storing Credentials

Credentials are stored using the standard pass multi-line format:
- **First line**: WebDAV password/API key
- **Additional lines**: `key: value` pairs

### Entry Structure

| Path | Purpose |
|------|---------|
| `b2c-cli/_default` | Global/shared credentials |
| `b2c-cli/<instance>` | Instance-specific credentials |

### Global Defaults (`_default`)

Store shared credentials that apply to all instances:

```bash
pass insert -m b2c-cli/_default
```

Enter (press Ctrl+D when done):
```

client-id: my-oauth-client
client-secret: my-oauth-secret
```

Note: The first line can be empty if you only need key-value fields.

### Instance-Specific Credentials

Store credentials for a specific instance:

```bash
pass insert -m b2c-cli/staging
```

Enter:
```
my-webdav-api-key
username: user@example.com
hostname: dev01-realm-customer.demandware.net
```

### Supported Fields

| Pass Key | Description |
|----------|-------------|
| (first line) | WebDAV password/API key |
| `username` | WebDAV username |
| `password` | Explicit password (overrides first line) |
| `hostname` | Instance hostname |
| `webdav-hostname` | WebDAV hostname (if different) |
| `code-version` | Code version |
| `client-id` | OAuth client ID |
| `client-secret` | OAuth client secret |
| `scopes` | OAuth scopes (comma-separated) |
| `short-code` | Instance short code |
| `account-manager-host` | Account Manager host |

## Configuration Resolution

The plugin resolves configuration in this order:

1. **Load global defaults** from `b2c-cli/_default` (if exists)
2. **Determine instance** (in priority order):
   - `--instance` CLI flag
   - `SFCC_PASS_INSTANCE` environment variable
3. **Load instance-specific config** and merge (instance overrides global)
4. **Return merged config** to CLI

### Merge Behavior

Instance-specific values override global values at the field level:

```
_default:
  client-id: shared-id
  client-secret: shared-secret

staging:
  my-api-key
  username: staging-user

Result: {
  clientId: "shared-id",
  clientSecret: "shared-secret",
  password: "my-api-key",
  username: "staging-user"
}
```

## Usage Examples

### Shared OAuth + Instance Credentials

```bash
# Store shared OAuth (used by all instances)
pass insert -m b2c-cli/_default
# Enter:
#   (empty line)
#   client-id: my-client-id
#   client-secret: my-secret

# Store instance-specific WebDAV credentials
pass insert -m b2c-cli/staging
# Enter:
#   my-webdav-api-key
#   username: user@example.com

# Use with explicit instance
b2c code deploy --instance staging
```

### Global OAuth Only (works with dw.json)

```bash
# Store just OAuth credentials globally
pass insert -m b2c-cli/_default
# Enter:
#   (empty line)
#   client-id: my-client-id
#   client-secret: my-secret

# dw.json provides hostname, username, password
# pass provides clientId, clientSecret
b2c code deploy
```

### Full Instance Configuration

```bash
pass insert -m b2c-cli/production
# Enter:
#   production-webdav-key
#   username: prod@example.com
#   hostname: prod-realm-customer.demandware.net
#   client-id: prod-client
#   client-secret: prod-secret
#   code-version: version1

b2c code deploy --instance production
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SFCC_PASS_PREFIX` | Path prefix in pass store | `b2c-cli` |
| `SFCC_PASS_INSTANCE` | Fallback instance name | (none) |

## Managing Credentials

### View Stored Entry

```bash
# Show entry contents
pass show b2c-cli/staging

# Show global defaults
pass show b2c-cli/_default
```

### Update Credentials

```bash
# Edit existing entry
pass edit b2c-cli/staging

# Or overwrite entirely
pass insert -m b2c-cli/staging
```

### Delete Credentials

```bash
# Delete instance config
pass rm b2c-cli/staging

# Delete global defaults
pass rm b2c-cli/_default
```

### List All Entries

```bash
pass ls b2c-cli
```

## Configuration Priority

When this plugin is installed, configuration is resolved in this order:

1. CLI flags and environment variables (highest priority)
2. `dw.json` file
3. `~/.mobify` file
4. **password-store credentials** (this plugin, fills in missing credentials)

## Troubleshooting

### Enable Debug Logging

```bash
DEBUG='oclif:*' b2c code list --instance staging
```

### Verify Plugin is Loaded

```bash
b2c plugins
```

You should see `b2c-plugin-password-store` in the list.

### Check pass is Available

```bash
which pass
pass ls
```

### Check Credentials Exist

```bash
pass show b2c-cli/staging
```

If you get an error, the entry doesn't exist or the path is wrong.

### GPG Agent Issues

If you're having trouble with GPG prompts:

```bash
# Restart GPG agent
gpgconf --kill gpg-agent

# Or use pinentry-mac for better macOS integration
brew install pinentry-mac
echo "pinentry-program $(which pinentry-mac)" >> ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent
```

## Security Considerations

- Credentials are encrypted with GPG (at rest and in transit within pass)
- Access requires your GPG private key passphrase
- Pass integrates with git for version control and sync
- Consider using a hardware security key (YubiKey) for GPG

## Related

- [B2C CLI Documentation](https://salesforcecommercecloud.github.io/b2c-developer-tooling/)
- [Creating Custom Plugins](https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html)
- [password-store](https://www.passwordstore.org/)
- [pass extensions](https://www.passwordstore.org/#extensions)

## License

MIT
