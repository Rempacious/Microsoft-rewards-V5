<p align="center">
  <img src="assets/logo.png" alt="Microsoft Rewards Bot" width="200">
</p>

<h1 align="center">Microsoft Rewards Bot</h1>

<p align="center">
  <strong>Open-source Microsoft Rewards automation with a plugin system</strong><br>
  Core features are open source. Premium features ship as a proprietary pre-installed plugin.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-4.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-24.15.0-green?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-PolyForm_Noncommercial-orange?style=for-the-badge" alt="License">
</p>

## What This Repo Gives You

- automated Microsoft Rewards search and account workflows
- a public plugin API for custom plugins
- a local plugin manager with `npm run plugins`
- signed auto-update checks on `npm start`
- a built-in official Core plugin that is loaded only when `plugins/plugins.jsonc` enables it

## Quick Start

1. Clone the repository.
2. Install Node.js 24.15.0.
3. Install dependencies with `npm install`.
4. Copy `src/accounts.example.json` to `src/accounts.json`.
5. Copy `src/config.example.json` to `src/config.json`.
6. Edit `plugins/plugins.jsonc` to enable or disable plugins.
7. Optionally run `npm run plugins` to manage plugins from the local Plugin Desk.
8. Start the bot with `npm start`.

`npm start` checks the signed release manifest before launch. `npm run dev` and `-dev` never auto-update.

The official Core plugin is distributed as V8 bytecode, so the release is strict about Node.js versions. Use Node.js 24.15.0; other versions are refused before launch.

## How Plugins Work

The bot scans the `plugins/` directory on startup.

- `plugins/plugins.jsonc` controls which plugins are active
- `enabled: true` loads a plugin
- `enabled: false` keeps a plugin installed but inactive
- `priority` controls load order
- each plugin can receive its own config object
- public plugins cannot register official premium Core tasks

Read the plugin docs here:

- [Plugin system overview](docs/plugins.md)
- [Create a plugin](docs/create-plugin.md)
- [Plugin API reference](docs/plugin-api.md)
- [Plugin publishing](docs/plugin-marketplace.md)
- [Official Core plugin](docs/core-plugin.md)
- [Node.js version](docs/node-version.md)
- [Dashboard testing](docs/dashboard-testing.md)
- [Auto-updates](docs/updates.md)
- [Troubleshooting](docs/troubleshooting.md)

## Documentation

See [docs/README.md](docs/README.md) for the public docs index.

## License

The open-source core is distributed under the PolyForm Noncommercial license.
The built-in Core plugin remains proprietary and is shipped as compiled bytecode.
