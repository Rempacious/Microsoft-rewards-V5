const crypto = require('crypto')
const { DEFAULT_PUBLIC_KEY, canonicalJson } = require('./updater/UpdateManager')

const privateKeyPem = process.env.MSRB_UPDATE_PRIVATE_KEY

if (!privateKeyPem) {
    console.error('MSRB_UPDATE_PRIVATE_KEY is missing.')
    console.error('Set it to the Ed25519 private key PEM that matches the updater public key.')
    process.exit(1)
}

let privateKey
try {
    privateKey = crypto.createPrivateKey(privateKeyPem)
} catch (error) {
    console.error(`MSRB_UPDATE_PRIVATE_KEY could not be loaded: ${error.message}`)
    process.exit(1)
}

const expectedPublicKey = crypto.createPublicKey(DEFAULT_PUBLIC_KEY).export({ type: 'spki', format: 'der' })
const actualPublicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' })

if (!crypto.timingSafeEqual(expectedPublicKey, actualPublicKey)) {
    console.error('MSRB_UPDATE_PRIVATE_KEY does not match the public key embedded in the updater.')
    console.error('Existing installs will reject manifests signed with this key.')
    process.exit(1)
}

const payload = Buffer.from(canonicalJson({ channel: 'stable', probe: true, schemaVersion: 1 }))
const signature = crypto.sign(null, payload, privateKey)
const verified = crypto.verify(null, payload, DEFAULT_PUBLIC_KEY, signature)

if (!verified) {
    console.error('Signing probe failed.')
    process.exit(1)
}

console.log('Update signing key matches the updater public key.')
