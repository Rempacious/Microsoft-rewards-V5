import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import fs from 'fs'
import type { Cookie } from 'patchright'
import path from 'path'

import type { Account, ConfigSaveFingerprint } from '../types/Account'
import type { Config } from '../types/Config'
import { validateAccounts, validateConfig } from './SchemaValidator'

let configCache: Config

function resolveFirstExistingFile(candidates: string[], label: string): string {
    const primaryCandidate = candidates[0]

    for (const candidate of candidates) {
        const candidatePath = path.join(__dirname, '../', candidate)

        if (fs.existsSync(candidatePath)) {
            if (candidate !== primaryCandidate) {
                console.warn(`[CONFIG] ${primaryCandidate} not found, using ${candidate}`)
            }

            return candidatePath
        }
    }

    throw new Error(`[CONFIG] Missing ${label}. Expected one of: ${candidates.join(', ')}`)
}

export function loadAccounts(): Account[] {
    try {
        const accountCandidates = process.argv.includes('-dev')
            ? ['accounts.dev.json', 'accounts.json', 'accounts.example.json']
            : ['accounts.json', 'accounts.example.json']

        const accountDir = resolveFirstExistingFile(accountCandidates, 'accounts file')
        const accounts = fs.readFileSync(accountDir, 'utf-8')
        const accountsData = JSON.parse(accounts)

        validateAccounts(accountsData)

        return accountsData
    } catch (error) {
        throw new Error(error as string)
    }
}

export function loadConfig(): Config {
    try {
        if (configCache) {
            return configCache
        }

        const configDir = resolveFirstExistingFile(['config.json', 'config.example.json'], 'config file')
        const config = fs.readFileSync(configDir, 'utf-8')

        const configData = JSON.parse(config)
        validateConfig(configData)

        configCache = configData

        return configData
    } catch (error) {
        throw new Error(error as string)
    }
}

export interface StorageOrigin {
    origin: string
    localStorage: Array<{ name: string; value: string }>
}

export async function loadSessionData(
    sessionPath: string,
    email: string,
    saveFingerprint: ConfigSaveFingerprint,
    isMobile: boolean
) {
    try {
        const cookiesFileName = isMobile ? 'session_mobile.json' : 'session_desktop.json'
        const cookieFile = path.join(__dirname, '../automation/', sessionPath, email, cookiesFileName)

        let cookies: Cookie[] = []
        if (fs.existsSync(cookieFile)) {
            const cookiesData = await fs.promises.readFile(cookieFile, 'utf-8')
            cookies = JSON.parse(cookiesData)
        }

        const fingerprintFileName = isMobile ? 'session_fingerprint_mobile.json' : 'session_fingerprint_desktop.json'
        const fingerprintFile = path.join(__dirname, '../automation/', sessionPath, email, fingerprintFileName)

        let fingerprint!: BrowserFingerprintWithHeaders
        const shouldLoadFingerprint = isMobile ? saveFingerprint.mobile : saveFingerprint.desktop
        if (shouldLoadFingerprint && fs.existsSync(fingerprintFile)) {
            const fingerprintData = await fs.promises.readFile(fingerprintFile, 'utf-8')
            fingerprint = JSON.parse(fingerprintData)
        }

        // Load localStorage/sessionStorage data
        const storageFileName = isMobile ? 'session_storage_mobile.json' : 'session_storage_desktop.json'
        const storageFile = path.join(__dirname, '../automation/', sessionPath, email, storageFileName)

        let storageState: StorageOrigin[] | undefined
        if (fs.existsSync(storageFile)) {
            const storageData = await fs.promises.readFile(storageFile, 'utf-8')
            storageState = JSON.parse(storageData)
        }

        return {
            cookies: cookies,
            fingerprint: fingerprint,
            storageState: storageState
        }
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveSessionData(
    sessionPath: string,
    cookies: Cookie[],
    email: string,
    isMobile: boolean
): Promise<string> {
    try {
        const sessionDir = path.join(__dirname, '../automation/', sessionPath, email)
        const cookiesFileName = isMobile ? 'session_mobile.json' : 'session_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, cookiesFileName), JSON.stringify(cookies))

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveFingerprintData(
    sessionPath: string,
    email: string,
    isMobile: boolean,
    fingerpint: BrowserFingerprintWithHeaders
): Promise<string> {
    try {
        const sessionDir = path.join(__dirname, '../automation/', sessionPath, email)
        const fingerprintFileName = isMobile ? 'session_fingerprint_mobile.json' : 'session_fingerprint_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, fingerprintFileName), JSON.stringify(fingerpint))

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveStorageState(
    sessionPath: string,
    storageState: StorageOrigin[],
    email: string,
    isMobile: boolean
): Promise<void> {
    try {
        const sessionDir = path.join(__dirname, '../automation/', sessionPath, email)
        const storageFileName = isMobile ? 'session_storage_mobile.json' : 'session_storage_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, storageFileName), JSON.stringify(storageState))
    } catch (error) {
        throw new Error(error as string)
    }
}
