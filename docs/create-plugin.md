# Create a Plugin

This tutorial creates a minimal public plugin.

## 1. Create the Folder

```text
plugins/summary/
├── index.js
├── package.json
└── README.md
```

## 2. Implement `index.js`

```js
class SummaryPlugin {
    name = 'summary'
    version = '1.0.0'
    botVersionRange = '>=4.0.0'
    capabilities = ['diagnostics']

    register(context) {
        context.log.info('main', 'SUMMARY', 'Summary plugin loaded')
        context.registerDiagnostics(() => [
            { level: 'info', message: 'Summary plugin is active' }
        ])
    }

    onAccountEnd({ log, result }) {
        log.info('main', 'SUMMARY', `${result.email}: +${result.collectedPoints} points`)
    }
}

module.exports = SummaryPlugin
```

## 3. Enable It

Add the plugin to `plugins/plugins.jsonc`:

```jsonc
{
  "summary": {
    "enabled": true,
    "priority": 50,
    "config": {}
  }
}
```

## 4. Test It

Start the bot and confirm the log contains:

```text
Registered plugin: summary@1.0.0
```

You can also run `npm run plugins` and enable or disable it from the local Plugin Desk.

## Good Defaults

- Keep the plugin folder name and `name` field identical.
- Document every config key in your README.
- Use the public import path `microsoft-rewards-bot/plugin-api` for TypeScript plugins.
- Do not rely on internal Core plugin APIs; they are reserved for the official paid plugin.
