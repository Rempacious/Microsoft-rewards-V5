# Local Dashboard

The dashboard is a small local web interface that starts with the bot when enabled. It is useful for users who prefer a browser view instead of watching the terminal.

## Configuration

Copy `src/config.example.json` to `src/config.json`, then set:

```json
"dashboard": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 3210,
    "openOnStart": true,
    "allowConfigWrite": true
}
```

`enabled` starts the dashboard with the bot.

`host` controls where the dashboard listens. Use `0.0.0.0` to make it available from another device on the same local network. Use `127.0.0.1` if it should only be available on the same machine.

`port` is the dashboard port.

`openOnStart` opens the browser automatically when the dashboard starts.

`allowConfigWrite` allows saving `src/config.json` from the dashboard.

## Network Access

When the dashboard starts, the bot prints the local address and any detected network addresses. Open one of those URLs from another computer on the same network.

Because the dashboard can expose configuration controls, only enable it on a trusted network.

## What It Shows

- current bot version and run state
- loaded accounts with masked email addresses
- recent activity logs
- current points gained for the active run
- a `Run now` button for manual starts when no run is already active
- local and network dashboard URLs
- JSON configuration editor

Changes saved from the dashboard are written to `src/config.json`. Some changes apply immediately, while settings used during a run may require restarting the bot.
