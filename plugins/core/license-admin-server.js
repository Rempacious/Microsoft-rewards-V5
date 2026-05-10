'use strict'

const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = __dirname
const DEFAULT_PORT = Number(process.env.MSRB_LICENSE_ADMIN_PORT || 8787)
const CONFIG_PATH = path.join(ROOT, 'license-admin.config.local.js')

function loadLocalConfig() {
    const defaults = {
        organizationSlug: 'lightzirconite',
        databaseName: 'microsoft-rewards-bot',
        platformToken: process.env.TURSO_PLATFORM_TOKEN || '',
        databaseUrl: process.env.TURSO_DATABASE_URL || '',
        databaseToken: process.env.TURSO_DATABASE_TOKEN || ''
    }

    if (!fs.existsSync(CONFIG_PATH)) return defaults

    const source = fs.readFileSync(CONFIG_PATH, 'utf8')
    const match = source.match(/window\.MSRB_LICENSE_ADMIN_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?/)
    if (!match) return defaults

    try {
        return { ...defaults, ...Function(`"use strict"; return (${match[1]});`)() }
    } catch {
        return defaults
    }
}

let cachedDatabaseUrl = ''
let cachedDatabaseToken = ''

async function resolveDatabaseConnection() {
    const config = loadLocalConfig()

    if (config.databaseUrl && config.databaseToken) {
        cachedDatabaseUrl = normalizeDatabaseUrl(config.databaseUrl)
        cachedDatabaseToken = config.databaseToken
        return { url: cachedDatabaseUrl, token: cachedDatabaseToken }
    }

    if (cachedDatabaseUrl && cachedDatabaseToken) {
        return { url: cachedDatabaseUrl, token: cachedDatabaseToken }
    }

    if (!config.organizationSlug || !config.databaseName || !config.platformToken) {
        throw new Error('Missing Turso connection. Fill license-admin.config.local.js.')
    }

    const databaseEndpoint = `https://api.turso.tech/v1/organizations/${encodeURIComponent(
        config.organizationSlug
    )}/databases/${encodeURIComponent(config.databaseName)}`

    const databasePayload = await tursoPlatformFetch(databaseEndpoint, config.platformToken)
    const database = databasePayload.database || databasePayload
    const hostname = database.hostname || database.Hostname
    if (!hostname) throw new Error('Turso database hostname not found.')

    const tokenPayload = await tursoPlatformFetch(`${databaseEndpoint}/auth/tokens`, config.platformToken, {
        method: 'POST',
        body: JSON.stringify({ authorization: 'full-access' })
    })
    const token = tokenPayload.jwt || tokenPayload.token
    if (!token) throw new Error('Turso database token not created.')

    cachedDatabaseUrl = `https://${hostname}`
    cachedDatabaseToken = token

    return { url: cachedDatabaseUrl, token: cachedDatabaseToken }
}

async function tursoPlatformFetch(url, token, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json'
        },
        body: options.body
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Turso API ${response.status}`)
    return payload
}

async function executeSql(sql, args = []) {
    const connection = await resolveDatabaseConnection()
    const response = await fetch(`${connection.url}/v2/pipeline`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${connection.token}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            requests: [
                { type: 'execute', stmt: { sql, args: args.map(toTursoArg) } },
                { type: 'close' }
            ]
        })
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.message || payload?.error || `Turso SQL ${response.status}`)
    const result = payload?.results?.[0]
    if (result?.type === 'error') throw new Error(result.error?.message || 'SQL error')
    return result?.response?.result || result?.result || { cols: [], rows: [] }
}

function toTursoArg(value) {
    if (value === null || value === undefined || value === '') return { type: 'null' }
    if (typeof value === 'number') return { type: 'integer', value: String(value) }
    return { type: 'text', value: String(value) }
}

function normalizeDatabaseUrl(value) {
    return String(value).trim().replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '')
}

function sendJson(res, status, body) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
    })
    res.end(JSON.stringify(body))
}

function sendFile(res, filePath, contentType) {
    res.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store'
    })
    fs.createReadStream(filePath).pipe(res)
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => {
            body += chunk
            if (body.length > 1_000_000) {
                req.destroy()
                reject(new Error('Request body too large'))
            }
        })
        req.on('end', () => resolve(body ? JSON.parse(body) : {}))
        req.on('error', reject)
    })
}

function openBrowser(url) {
    const command =
        process.platform === 'win32'
            ? 'cmd'
            : process.platform === 'darwin'
              ? 'open'
              : 'xdg-open'
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.unref()
}

const server = http.createServer(async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex')

    try {
        const url = new URL(req.url || '/', `http://${req.headers.host}`)

        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/license-admin.html')) {
            sendFile(res, path.join(ROOT, 'license-admin.html'), 'text/html; charset=utf-8')
            return
        }

        if (req.method === 'POST' && url.pathname === '/api/query') {
            const body = await readBody(req)
            if (!body || typeof body.sql !== 'string' || !Array.isArray(body.args)) {
                sendJson(res, 400, { error: 'Invalid query payload' })
                return
            }
            const result = await executeSql(body.sql, body.args)
            sendJson(res, 200, { result })
            return
        }

        sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
        sendJson(res, 500, {
            error: error instanceof Error ? error.message : String(error),
            requestId
        })
    }
})

server.listen(DEFAULT_PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${DEFAULT_PORT}/license-admin.html`
    console.log(`MSRB Core License Desk running at ${url}`)
    if (process.env.MSRB_LICENSE_ADMIN_OPEN !== '0') openBrowser(url)
})
