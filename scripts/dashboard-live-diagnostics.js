const fs = require('fs')
const path = require('path')
const { chromium } = require('patchright')
const { analyzeSavedPage } = require('./rewards-page-analyzer')

const DASHBOARD_URL = 'https://rewards.bing.com/dashboard'

async function readDomSignals(page) {
    return page.evaluate(() => {
        const panels = Array.from(
            document.querySelectorAll('[role="dialog"], .react-aria-DisclosurePanel:not([hidden])')
        ).filter(el => {
            const rect = el.getBoundingClientRect()
            const style = window.getComputedStyle(el)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        })

        return {
            url: location.href,
            title: document.title,
            loggedInLikely: !/signin|login|oauth|\/welcome/i.test(location.href),
            dashboardReady: location.pathname === '/dashboard' && Boolean(document.querySelector('section#snapshot, section#dailyset')),
            welcomePage: /\/welcome/i.test(location.pathname),
            snapshotSection: Boolean(document.querySelector('section#snapshot')),
            dailySetSection: Boolean(document.querySelector('section#dailyset')),
            switches: Array.from(document.querySelectorAll('input[role="switch"]')).map(input => ({
                checked: input.checked,
                disabled: input.disabled,
                ariaLabel: input.getAttribute('aria-label')
            })),
            disclosureTriggers: document.querySelectorAll('button[aria-expanded]').length,
            visiblePanels: panels.length,
            progressBars: document.querySelectorAll('[role="progressbar"]').length
        }
    })
}

async function openStreakPanel(page) {
    return page.evaluate(() => {
        const isVisible = el => {
            const rect = el.getBoundingClientRect()
            const style = window.getComputedStyle(el)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }

        const snapshot = document.querySelector('section#snapshot')
        const trigger = snapshot?.querySelector('button[slot="trigger"][aria-expanded="false"]')
        if (trigger) trigger.click()

        const images = Array.from((snapshot ?? document).querySelectorAll('img[src], img[srcset]'))
        const fire = images.find(img => {
            const src = img.getAttribute('src') ?? ''
            const srcset = img.getAttribute('srcset') ?? ''
            return src.includes('Fire') || srcset.includes('Fire')
        })
        const card = fire?.closest('button[aria-expanded], button[data-rac], a[data-rac]')
        if (!card || !isVisible(card)) return false
        card.click()
        return true
    })
}

async function toggleFirstSwitch(page, desiredEnabled) {
    return page.evaluate(desiredEnabled => {
        const isVisible = el => {
            const rect = el.getBoundingClientRect()
            const style = window.getComputedStyle(el)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }

        const input = Array.from(document.querySelectorAll('input[role="switch"]')).find(el => {
            const label = el.closest('label')
            return isVisible(el) || (label && isVisible(label))
        })
        if (!input) return { found: false, disabled: false, before: null, after: null, changed: false }

        const before = input.checked
        const disabled = input.disabled || input.closest('[data-disabled="true"]') !== null
        if (!disabled && before !== desiredEnabled) {
            const label = input.closest('label')
            ;(label ?? input).click()
        }

        return { found: true, disabled, before, after: input.checked, changed: before !== input.checked }
    }, desiredEnabled)
}

async function main() {
    if (process.env.MSRB_LIVE_DASHBOARD !== '1') {
        console.error('Refusing to run live diagnostics. Set MSRB_LIVE_DASHBOARD=1 first.')
        process.exit(1)
    }

    const writeEnabled = process.env.MSRB_LIVE_DASHBOARD_WRITE === '1'
    const userDataDir = path.join(process.cwd(), 'sessions', 'dashboard-live-diagnostics')
    fs.mkdirSync(userDataDir, { recursive: true })

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 768, height: 1024 }
    })

    try {
        const page = context.pages()[0] ?? await context.newPage()
        await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000)

        let before = await readDomSignals(page)
        if (!before.dashboardReady && process.env.MSRB_LIVE_DASHBOARD_INTERACTIVE === '1') {
            console.error(
                'Dashboard is not ready yet. Finish login/welcome in the opened browser; diagnostics will retry in 120 seconds.'
            )
            await page.waitForTimeout(120000)
            await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
            await page.waitForTimeout(3000)
            before = await readDomSignals(page)
        }

        const html = await page.content()
        const rsc = analyzeSavedPage(html)
        const openedStreakPanel = await openStreakPanel(page)
        await page.waitForTimeout(1200)
        const afterOpen = await readDomSignals(page)
        const toggleResult = writeEnabled ? await toggleFirstSwitch(page, true) : null

        console.log(
            JSON.stringify(
                {
                    writeEnabled,
                    before,
                    rsc: {
                        kind: rsc.kind,
                        route: rsc.route,
                        modelTypes: rsc.modelTypes,
                        activityCount: rsc.activities?.length,
                        diagnostics: rsc.diagnostics,
                        problems: rsc.problems
                    },
                    nextAction: before.welcomePage
                        ? 'Finish the Microsoft Rewards welcome/onboarding page in the opened browser, then rerun this command.'
                        : before.dashboardReady
                          ? 'Dashboard detected.'
                          : 'Dashboard not detected. Make sure this session is logged in and can open https://rewards.bing.com/dashboard.',
                    openedStreakPanel,
                    afterOpen,
                    toggleResult
                },
                null,
                2
            )
        )
    } finally {
        await context.close()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
