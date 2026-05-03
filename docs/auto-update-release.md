# Auto-Update Manifest Checklist

This guide explains only how to prepare the files used by the auto-updater. It does not cover Git history cleanup or repository publishing.

## Goal

Make `npm start` detect a new signed release, download the expected archive, verify it, preserve user files, and apply the update.

## Required Environment

- Node.js `24.15.0`
- access to the update signing private key in `MSRB_UPDATE_PRIVATE_KEY`

## Files Used By The Updater

- `updates/stable.json`: signed manifest for the stable channel
- `updates/beta.json`: optional signed manifest for the beta channel
- `scripts/updater/UpdateManager.js`: manifest verification, archive verification, staging, apply, rollback
- `scripts/updater/ConfigMigrator.js`: non-destructive `config.json` and `accounts.json` migration
- `plugins/official-core.json`: official Core checksum
- `plugins/catalog.json`: local store catalogue and Core checksum display

## Preparation Steps

1. Build and test the open-source bot.

```bash
npm run node:check
npm install
npx tsc --noEmit
npm test
npm run test:dashboard:mock
npm audit --audit-level=moderate
```

2. Rebuild the official Core plugin from `Core-Source` with Node.js `24.15.0`.

```bash
cd ../Core-Source
npm install
npx tsc --noEmit
npm audit --audit-level=moderate
npm run build:release
```

3. Copy the Core release into the open-source repository.

- copy `Core-Source/release/*` to `Microsoft-Rewards-Bot/plugins/core/`
- copy `Core-Source/release/official-core.json` to `Microsoft-Rewards-Bot/plugins/official-core.json`
- remove `plugins/core/official-core.json` after copying
- update `plugins/catalog.json` with the SHA-256 of `plugins/core/index.jsc`

4. Verify the Core checksum.

```powershell
(Get-FileHash -Algorithm SHA256 plugins/core/index.jsc).Hash.ToLowerInvariant()
```

The value must match:

- `plugins/core/package.json` -> `msrb.indexSha256`
- `plugins/official-core.json` -> `indexSha256`
- `plugins/catalog.json` -> Core `sha256`

5. Update `updates/stable.json`.

Set:

- `botVersion` to the public bot version
- `coreVersion` to the Core plugin version
- `compatibleNode` to `24.15.0`
- `archiveUrl` to the archive users should download
- `sha256` to the SHA-256 of that archive

Do not edit `signature` manually.

6. Sign the manifest with the private Ed25519 key.

```bash
MSRB_UPDATE_PRIVATE_KEY="<ed25519-private-key-pem>" npm run update:sign
```

7. Validate the signed update in dry-run mode.

```bash
npm run update:check
```

Expected result:

- the manifest signature is accepted
- local and remote versions are printed
- preserved paths are listed
- no checksum or signature error appears

## Preserved User Files

The updater must preserve user-owned files and folders:

- `.git`
- `.updates`
- `node_modules`
- `dist`
- `release`
- `logs`
- `diagnostics`
- `Page`
- `sessions`
- `src/config.json`
- `src/accounts.json`
- `plugins/plugins.jsonc`
- `plugins/*/node_modules`
- `plugins/*/.cache`

If new config keys are added, update the example files. The updater migrates missing keys from examples without replacing user values.

## What Not To Do

- Do not ship database tokens, API keys, private keys, or license backend secrets.
- Do not change `updates/stable.json` without re-signing it.
- Do not rebuild Core bytecode with another Node.js version.
- Do not publish source files from Core in `plugins/core`.
- Do not rely on obfuscation as secret storage.
