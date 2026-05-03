# Plugin Marketplace

Run the local plugin manager with:

```bash
npm run plugins
```

It serves a local HTML interface on `127.0.0.1`. The Plugin Desk has tabs for installed plugins, catalog entries, update status, and local settings. It can enable/disable installed plugins, verify checksums, and refuse activation when a catalog checksum does not match the local entry file.

## Catalog Format

Catalog entries live in `plugins/catalog.json`:

```json
{
  "plugins": [
    {
      "name": "summary",
      "version": "1.0.0",
      "description": "Account run summaries.",
      "license": "MIT",
      "price": "free",
      "botVersionRange": ">=4.0.0",
      "installUrl": "https://example.com/summary.zip",
      "supportUrl": "https://discord.gg/example",
      "purchaseUrl": "https://discord.gg/example",
      "sha256": "expected-release-checksum"
    }
  ]
}
```

For v1, paid plugins use an external Discord or purchase link. Payment, commission, and license handling are intentionally outside the local UI.

The local UI does not sandbox plugin code. It only manages activation and integrity metadata. Users should install plugins only from trusted authors.

## Package Requirements

A distributable plugin should include:

- `index.js` or `index.jsc`
- `package.json`
- `README.md`
- `LICENSE`
- documented config keys
- checksum for the released archive or entry file
- optional install, support, and purchase links

## Publishing Rules

- Say whether the plugin is free, paid, open source, or proprietary.
- Never present a plugin license as the bot license.
- State supported bot versions with `botVersionRange`.
- Provide a support or contact link.
- Do not claim access to official Core premium capabilities unless it is the official Core plugin.

## Official Core Plugin

The Core plugin is preinstalled in `plugins/core`. Its bytecode checksum is pinned by `plugins/official-core.json`; if the bytecode does not match, the bot refuses to grant official premium entitlement.

Third-party plugins cannot claim official Core entitlement. They use the public plugin API only.
