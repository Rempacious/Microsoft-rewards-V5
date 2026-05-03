const { UpdateManager } = require('./updater/UpdateManager')

const dryRun = process.argv.includes('--dry-run')

new UpdateManager()
    .run({ dryRun })
    .then(result => {
        if (result.status === 'failed') process.exitCode = 1
    })
    .catch(error => {
        console.error(`[UPDATER] ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
    })
