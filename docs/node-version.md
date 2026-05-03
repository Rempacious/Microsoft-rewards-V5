# Node.js Version

Use **Node.js 24.15.0**.

The accepted version is:

```text
24.15.0
```

The bot checks this before `npm start`, `npm run dev`, and `npm run ts-start`.

## Check Your Version

```powershell
node -v
npm run node:check
```

If the check fails, install Node.js 24.15.0, then reinstall dependencies:

```powershell
npm install
npm start
```

## Why This Is Strict

The official Core plugin is distributed as V8 bytecode through `bytenode`. Bytecode is tied to Node.js/V8 compatibility. Running it on another Node.js version can fail at runtime or behave unpredictably.

For this reason, the official release refuses every Node.js version except 24.15.0 before loading the bot.

## Security Note

Bytecode and obfuscation slow down reverse engineering, but they are not a secret-storage mechanism. Never ship database tokens, API keys, private keys, or license backend secrets inside Core bytecode. Server secrets must stay server-side.

The supported protection model is:

- strict Node.js version for bytecode compatibility;
- signed/checksummed Core bytecode;
- license validation through your backend;
- no server secrets in the shipped plugin;
- public plugins cannot grant official Core entitlement.
