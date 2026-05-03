const childProcess = require('child_process')
const { UpdateManager } = require('./updater/UpdateManager')

function run(command, args) {
    const result = childProcess.spawnSync(command, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32'
    })

    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

async function main() {
    const updater = new UpdateManager()
    await updater.run()

    run('npm', ['run', 'build'])
    run('node', ['./dist/index.js'])
}

main().catch(error => {
    console.error(`[START] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
})
