# Microsoft Rewards Bot v4.0.1

Microsoft Rewards Bot v4.0.1 is now available on the `release` branch.

This update focuses on reliability, safer operation, and a smoother setup for both open-source users and Core plugin users.

## What's New

- Added an optional local web dashboard for the open-source bot.
- Added scheduler support so the bot can run now, wait, and restart at the configured daily time.
- Added a remote safety advisory check that can warn users when running the bot is considered risky.
- Added a warning when more than four accounts are configured.
- Added a Core License Desk for local license management, including create, edit, disable, delete, notes, plan, expiration, and machine limits.
- Rebuilt and refreshed the official Core plugin bytecode.

## Fixes And Improvements

- Chrome is now preferred before Edge when choosing a browser channel.
- Session files are kept outside the rebuilt `dist` folder so logins are not wiped by each start/build cycle.
- Microsoft login handling was improved for password/passkey interruption screens.
- Dashboard data fallback handling was improved.
- Auto-update now uses the GitHub release manifest plus archive SHA-256 verification without requiring the old missing private signing key.
- Core license documentation now explains that runtime validation calls the official license API, while the backend checks the Turso database and returns a signed response.

## Notes

- The open-source bot still works without the Core plugin.
- Core requires a valid license and a configured license response public key.
- Users already on a build that still requires the old manifest signature may need one manual update/install once, because that older updater cannot accept any changed manifest without the lost private key.
