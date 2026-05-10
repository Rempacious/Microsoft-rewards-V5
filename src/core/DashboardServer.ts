import { spawn } from 'child_process'
import fs from 'fs'
import http, { IncomingMessage, ServerResponse } from 'http'
import os from 'os'
import path from 'path'
import pkg from '../../package.json'

import { validateConfig } from '../helpers/SchemaValidator'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../types/Account'

type BotIntrospection = {
    accounts?: Account[]
}

export class DashboardServer {
    private server?: http.Server
    private manualRunActive = false

    constructor(private bot: MicrosoftRewardsBot) {}

    start(): Promise<void> {
        if (this.server) return Promise.resolve()

        const dashboardConfig = this.bot.config.dashboard
        const host = dashboardConfig?.host || '0.0.0.0'
        const port = dashboardConfig?.port || 3210

        this.server = http.createServer((req, res) => {
            void this.route(req, res)
        })

        return new Promise((resolve, reject) => {
            this.server?.once('error', reject)
            this.server?.listen(port, host, () => {
                this.server?.off('error', reject)
                const actualPort = this.getPort()
                const localUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}`
                this.bot.logger.info(
                    'main',
                    'DASHBOARD',
                    `Dashboard available at ${localUrl} | network: ${this.networkUrls(actualPort).join(', ') || 'none'}`
                )

                if (dashboardConfig?.openOnStart) {
                    this.openBrowser(localUrl)
                }

                resolve()
            })
        })
    }

    stop(): Promise<void> {
        return new Promise(resolve => {
            if (!this.server) {
                resolve()
                return
            }

            this.server.close(() => {
                this.server = undefined
                resolve()
            })
        })
    }

    private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const requestUrl = new URL(req.url || '/', 'http://localhost')

            if (req.method === 'GET' && requestUrl.pathname === '/') {
                this.html(res)
                return
            }

            if (req.method === 'GET' && requestUrl.pathname === '/api/status') {
                this.json(res, this.statusPayload())
                return
            }

            if (req.method === 'GET' && requestUrl.pathname === '/api/config') {
                this.json(res, { config: this.bot.config })
                return
            }

            if (req.method === 'POST' && requestUrl.pathname === '/api/config') {
                if (!this.bot.config.dashboard?.allowConfigWrite) {
                    this.json(res, { error: 'Config editing is disabled in dashboard.allowConfigWrite.' }, 403)
                    return
                }

                const nextConfig = validateConfig(await this.readJson(req))
                await fs.promises.writeFile(this.configPath(), `${JSON.stringify(nextConfig, null, 4)}\n`, 'utf-8')
                this.bot.config = nextConfig
                this.json(res, { ok: true, config: nextConfig })
                return
            }

            if (req.method === 'POST' && requestUrl.pathname === '/api/run') {
                if (this.manualRunActive || this.bot.dashboardRunState === 'running') {
                    this.json(res, { error: 'A run is already in progress.' }, 409)
                    return
                }

                this.manualRunActive = true
                this.bot.dashboardRunState = 'running'
                void this.bot
                    .run()
                    .then(exitCode => {
                        this.bot.dashboardRunState = exitCode === 0 ? 'finished' : 'error'
                    })
                    .catch(error => {
                        this.bot.dashboardRunState = 'error'
                        this.bot.logger.error('main', 'DASHBOARD-RUN', error as Error)
                    })
                    .finally(() => {
                        this.manualRunActive = false
                    })
                this.json(res, { ok: true })
                return
            }

            this.json(res, { error: 'Not found' }, 404)
        } catch (error) {
            this.json(res, { error: error instanceof Error ? error.message : String(error) }, 500)
        }
    }

    private statusPayload(): object {
        const accounts = ((this.bot as unknown) as BotIntrospection).accounts || []
        const port = this.getPort()
        const sanitizedAccounts = accounts.map(account => ({
            email: maskEmail(account.email),
            geoLocale: account.geoLocale,
            langCode: account.langCode,
            saveFingerprint: account.saveFingerprint
        }))

        return {
            version: pkg.version,
            uptimeSeconds: Math.floor(process.uptime()),
            runState: this.bot.dashboardRunState,
            urls: {
                local: `http://localhost:${port}`,
                network: this.networkUrls(port)
            },
            accounts: sanitizedAccounts,
            userData: this.bot.userData,
            configSummary: {
                headless: this.bot.config.headless,
                clusters: this.bot.config.clusters,
                sessionPath: this.bot.config.sessionPath,
                scheduler: this.bot.config.scheduler,
                safetyAdvisory: this.bot.config.safetyAdvisory,
                dashboard: this.bot.config.dashboard
            },
            logs: this.bot.dashboardEvents.slice(-180)
        }
    }

    private html(res: ServerResponse): void {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(DASHBOARD_HTML)
    }

    private json(res: ServerResponse, payload: unknown, status = 200): void {
        res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*'
        })
        res.end(JSON.stringify(payload))
    }

    private readJson(req: IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = []
            req.on('data', chunk => chunks.push(Buffer.from(chunk)))
            req.on('error', reject)
            req.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'))
                } catch (error) {
                    reject(error)
                }
            })
        })
    }

    private getPort(): number {
        const address = this.server?.address()
        return typeof address === 'object' && address ? address.port : this.bot.config.dashboard?.port || 3210
    }

    private networkUrls(port: number): string[] {
        const urls: string[] = []
        for (const entries of Object.values(os.networkInterfaces())) {
            for (const entry of entries || []) {
                if (entry.family === 'IPv4' && !entry.internal) urls.push(`http://${entry.address}:${port}`)
            }
        }
        return urls
    }

    private configPath(): string {
        const sourceConfig = path.resolve(process.cwd(), 'src', 'config.json')
        const sourceDir = path.dirname(sourceConfig)
        if (fs.existsSync(sourceConfig) || fs.existsSync(sourceDir)) return sourceConfig

        return path.join(__dirname, '../config.json')
    }

    private openBrowser(url: string): void {
        const command =
            process.platform === 'win32'
                ? { file: 'cmd', args: ['/c', 'start', '', url] }
                : process.platform === 'darwin'
                  ? { file: 'open', args: [url] }
                  : { file: 'xdg-open', args: [url] }

        const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore' })
        child.unref()
    }
}

function maskEmail(email: string): string {
    const [name, domain] = email.split('@')
    if (!name || !domain) return email
    return `${name.slice(0, 2)}***@${domain}`
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Microsoft Rewards Bot Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #071019;
      --panel: #0e1a27;
      --panel-2: #132335;
      --line: #28405a;
      --text: #edf5ff;
      --muted: #93a9c3;
      --teal: #2dd4bf;
      --blue: #60a5fa;
      --rose: #fb7185;
      --amber: #fbbf24;
      --green: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 15% 0%, rgba(45, 212, 191, .16), transparent 30%),
        linear-gradient(135deg, #071019 0%, #0b1220 58%, #111827 100%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 5;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(7, 16, 25, .86);
      backdrop-filter: blur(18px);
    }
    .bar, main { width: min(1380px, calc(100% - 32px)); margin: 0 auto; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 22px; letter-spacing: 0; }
    main { padding: 22px 0 32px; display: grid; gap: 16px; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 12px;
      color: var(--muted);
      background: rgba(14,26,39,.72);
      font-weight: 800;
      font-size: 13px;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 18px currentColor; }
    .dot.running { background: var(--green); }
    .grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 16px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .card, .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(14,26,39,.88);
      box-shadow: 0 18px 60px rgba(0,0,0,.22);
    }
    .card { padding: 14px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 900; }
    .value { margin-top: 8px; font-size: 24px; font-weight: 950; }
    .panel { overflow: hidden; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border-bottom: 1px solid var(--line); }
    .panel-body { padding: 14px; }
    button {
      min-height: 38px;
      border: 1px solid #3d5d7e;
      border-radius: 8px;
      background: linear-gradient(135deg, #14b8a6, #2563eb);
      color: white;
      padding: 8px 12px;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }
    button.secondary { background: var(--panel-2); color: var(--text); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; border-bottom: 1px solid #20344a; text-align: left; font-size: 13px; }
    th { color: var(--muted); text-transform: uppercase; font-size: 11px; }
    textarea {
      width: 100%;
      min-height: 420px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #08111d;
      color: var(--text);
      padding: 12px;
      font: 13px/1.5 "Cascadia Mono", Consolas, monospace;
    }
    .logs { display: grid; gap: 8px; max-height: 520px; overflow: auto; }
    .log { border: 1px solid #20344a; border-radius: 8px; padding: 10px; background: #0a1522; }
    .log strong { color: var(--blue); }
    .log.warn strong { color: var(--amber); }
    .log.error strong { color: var(--rose); }
    .log small { color: var(--muted); display: block; margin-bottom: 4px; }
    .urls { display: flex; flex-wrap: wrap; gap: 8px; }
    a { color: var(--teal); text-decoration: none; }
    .status { color: var(--muted); font-weight: 800; }
    @media (max-width: 980px) {
      .bar { align-items: flex-start; flex-direction: column; }
      .grid, .metrics { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <div>
        <h1>Microsoft Rewards Bot</h1>
        <p class="status" id="subtitle">Loading dashboard...</p>
      </div>
      <div class="actions">
        <button id="runNow" type="button">Run now</button>
        <span class="pill"><span id="stateDot" class="dot"></span><span id="stateText">starting</span></span>
      </div>
    </div>
  </header>
  <main>
    <section class="metrics">
      <div class="card"><p class="label">Version</p><p class="value" id="version">-</p></div>
      <div class="card"><p class="label">Accounts</p><p class="value" id="accountsCount">0</p></div>
      <div class="card"><p class="label">Points gained</p><p class="value" id="points">0</p></div>
      <div class="card"><p class="label">Uptime</p><p class="value" id="uptime">0m</p></div>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Recent activity</h2>
          <button id="refresh" class="secondary" type="button">Refresh</button>
        </div>
        <div class="panel-body logs" id="logs"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Access</h2></div>
        <div class="panel-body">
          <div class="urls" id="urls"></div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head"><h2>Accounts</h2></div>
        <div class="panel-body">
          <table>
            <thead><tr><th>Email</th><th>Locale</th><th>Language</th><th>Fingerprint</th></tr></thead>
            <tbody id="accounts"></tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Configuration</h2>
          <button id="saveConfig" type="button">Save</button>
        </div>
        <div class="panel-body">
          <textarea id="configEditor" spellcheck="false"></textarea>
          <p class="status" id="saveStatus"></p>
        </div>
      </div>
    </section>
  </main>
  <script>
    const state = { configLoaded: false }
    const byId = id => document.getElementById(id)
    byId('refresh').addEventListener('click', loadStatus)
    byId('saveConfig').addEventListener('click', saveConfig)
    byId('runNow').addEventListener('click', runNow)
    loadConfig()
    loadStatus()
    setInterval(loadStatus, 3000)

    async function loadConfig() {
      const data = await fetch('/api/config').then(r => r.json())
      byId('configEditor').value = JSON.stringify(data.config, null, 4)
      state.configLoaded = true
    }

    async function loadStatus() {
      const data = await fetch('/api/status').then(r => r.json())
      byId('version').textContent = data.version
      byId('accountsCount').textContent = data.accounts.length
      byId('points').textContent = data.userData.gainedPoints || 0
      byId('uptime').textContent = Math.floor(data.uptimeSeconds / 60) + 'm'
      byId('subtitle').textContent = 'Local dashboard on ' + data.urls.local
      byId('stateText').textContent = data.runState
      byId('stateDot').className = 'dot ' + (data.runState === 'running' ? 'running' : '')
      byId('urls').innerHTML = [data.urls.local].concat(data.urls.network).map(url => '<a class="pill" href="' + url + '">' + url + '</a>').join('')
      byId('accounts').innerHTML = data.accounts.map(account => '<tr><td>' + esc(account.email) + '</td><td>' + esc(account.geoLocale) + '</td><td>' + esc(account.langCode) + '</td><td>' + esc(JSON.stringify(account.saveFingerprint)) + '</td></tr>').join('') || '<tr><td colspan="4">No accounts loaded.</td></tr>'
      byId('logs').innerHTML = data.logs.slice().reverse().map(log => '<div class="log ' + esc(log.level) + '"><small>' + new Date(log.time).toLocaleString() + ' | ' + esc(log.platform) + ' | ' + esc(log.userName) + '</small><strong>' + esc(log.level.toUpperCase()) + ' [' + esc(log.title) + ']</strong><div>' + esc(log.message) + '</div></div>').join('') || '<p class="status">No activity yet.</p>'
    }

    async function saveConfig() {
      try {
        const parsed = JSON.parse(byId('configEditor').value)
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed)
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not save config.')
        byId('configEditor').value = JSON.stringify(data.config, null, 4)
        byId('saveStatus').textContent = 'Configuration saved.'
      } catch (error) {
        byId('saveStatus').textContent = error.message
      }
    }

    async function runNow() {
      try {
        const response = await fetch('/api/run', { method: 'POST' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not start run.')
        byId('saveStatus').textContent = 'Run started.'
        await loadStatus()
      } catch (error) {
        byId('saveStatus').textContent = error.message
      }
    }

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    }
  </script>
</body>
</html>`
