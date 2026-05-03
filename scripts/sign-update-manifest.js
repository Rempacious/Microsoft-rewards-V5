const crypto = require('crypto')
const fs = require('fs')
const { canonicalJson, stripSignature } = require('./updater/UpdateManager')

const manifestPath = process.argv[2]
const privateKey = process.env.MSRB_UPDATE_PRIVATE_KEY

if (!manifestPath || !privateKey) {
    console.error('Usage: MSRB_UPDATE_PRIVATE_KEY="<pem>" node scripts/sign-update-manifest.js updates/stable.json')
    process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const payload = Buffer.from(canonicalJson(stripSignature(manifest)))
const signature = crypto.sign(null, payload, privateKey).toString('base64')

manifest.signature = signature
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Signed ${manifestPath}`)
