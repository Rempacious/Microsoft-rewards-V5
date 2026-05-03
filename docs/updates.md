# Auto-Updates

`npm start` checks for updates before building and launching the bot.

`npm run dev` and any launch using `-dev` always skip auto-update, so local development is not overwritten by the public release branch.

## Release Manifest

The default channel is `stable`. The updater reads:

```text
https://raw.githubusercontent.com/QuestPilot/Microsoft-Rewards-Bot/release/updates/stable.json
```

The manifest is signed with Ed25519 and includes:

- `botVersion`
- `coreVersion`
- `compatibleNode`
- `archiveUrl`
- `sha256`
- `signature`
- preserved paths

The updater refuses an archive when the manifest signature or archive checksum is invalid.

## Preserved User Files

Updates preserve local user data:

- `src/config.json`
- `src/accounts.json`
- `plugins/plugins.jsonc`
- `sessions/`
- `logs/`
- `diagnostics/`
- `.updates/`

After an update, missing keys from `config.example.json` and `accounts.example.json` are added without replacing user values.

## Commands

```bash
npm start
npm run update:check
npm run update:sign
```

Set `MSRB_UPDATE_CHANNEL=beta` to use another channel. Set `MSRB_UPDATE_MANIFEST_URL` for a custom manifest URL. Set `MSRB_AUTO_UPDATE=0` only for CI or emergency local recovery.
