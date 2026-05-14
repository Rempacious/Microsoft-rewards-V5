import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../../../index'
import type { DashboardInfo } from '../../InternalPluginAPI'
import { URLS } from '../../../automation/DashboardSelectors'

export class DashboardInfoCollector {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async collect(page: Page): Promise<DashboardInfo> {
        try {
            if (!page.url().includes('rewards.bing.com')) {
                await page.goto(URLS.dashboard, { waitUntil: 'domcontentloaded' })
                await this.bot.utils.wait(2000)
            }

            const info = await page.evaluate(() => {
                const getNumber = (text: string | null): number | null => {
                    if (!text) return null
                    const match = text.replace(/,/g, '').match(/[\d]+/)
                    return match ? parseInt(match[0]) : null
                }

                // Extract user name from various dashboard locations
                let userName: string | null = null
                const greetingEl = document.querySelector('[class*="greeting"], [class*="userName"], [class*="user-name"]')
                if (greetingEl) {
                    userName = greetingEl.textContent?.trim() ?? null
                }
                // Fallback: look for hi/hello patterns
                if (!userName) {
                    const allText = document.body.innerText
                    const hiMatch = allText.match(/(?:Hi|Hello|Welcome),?\s+([A-Za-z]+)/i)
                    if (hiMatch?.[1]) userName = hiMatch[1]
                }

                // Extract level
                let level: string | null = null
                const levelEl = document.querySelector('[class*="level"], [class*="Level"], [data-testid*="level"]')
                if (levelEl) {
                    level = levelEl.textContent?.trim() ?? null
                }
                // Fallback: search for Level 1/2 pattern
                if (!level) {
                    const levelMatch = document.body.innerText.match(/Level\s*(\d)/i)
                    if (levelMatch) level = `Level ${levelMatch[1]}`
                }

                // Extract available points
                let availablePoints: number | null = null
                // Try the hero section first
                const pointsEl = document.querySelector('[class*="pointsValue"], [class*="points-value"], [class*="availablePoints"], [data-testid*="points"]')
                if (pointsEl) {
                    availablePoints = getNumber(pointsEl.textContent)
                }
                // Fallback: look for large number displays
                if (availablePoints === null) {
                    const largeNumbers = document.querySelectorAll('span, div, p')
                    for (const el of largeNumbers) {
                        const text = el.textContent?.trim() ?? ''
                        const num = getNumber(text)
                        if (num && num > 100 && text.length < 15 && !text.includes('/')) {
                            const style = window.getComputedStyle(el)
                            const fontSize = parseFloat(style.fontSize)
                            if (fontSize >= 24) {
                                availablePoints = num
                                break
                            }
                        }
                    }
                }

                // Extract today's points
                let todayPoints: number | null = null
                const todayEl = document.querySelector('[class*="today"], [class*="earned-today"]')
                if (todayEl) {
                    todayPoints = getNumber(todayEl.textContent)
                }

                // Extract streak days
                let streakDays: number | null = null
                const streakEl = document.querySelector('[class*="streak"], [class*="Streak"]')
                if (streakEl) {
                    streakDays = getNumber(streakEl.textContent)
                }
                // Also try "X days" pattern
                if (streakDays === null) {
                    const streakMatch = document.body.innerText.match(/(\d+)\s*(?:day|jour|Tag|día)s?\s*(?:streak|série|Serie)/i)
                    if (streakMatch?.[1]) streakDays = parseInt(streakMatch[1])
                }

                // Extract claim entries from the snapshot section
                const claimEntries: Array<{category: string, date: string, expiryDate: string, points: number}> = []
                let readyToClaimPoints = 0
                let hasClaimEntryExpiringSoon = false

                // Look for claim/redeem cards in the dashboard
                const claimCards = document.querySelectorAll('[class*="claim"], [class*="redeem"], [class*="available-reward"]')
                for (const card of claimCards) {
                    const cardText = card.textContent ?? ''
                    const pointsMatch = cardText.replace(/,/g, '').match(/(\d+)\s*(?:points?|pts)/i)
                    if (pointsMatch?.[1]) {
                        const points = parseInt(pointsMatch[1])
                        readyToClaimPoints += points
                        claimEntries.push({
                            category: cardText.slice(0, 30).trim(),
                            date: new Date().toISOString(),
                            expiryDate: '',
                            points
                        })
                    }
                    if (/expir|soon|aujourd|heute/i.test(cardText)) {
                        hasClaimEntryExpiringSoon = true
                    }
                }

                return {
                    userName,
                    level,
                    availablePoints,
                    readyToClaimPoints,
                    claimEntries,
                    hasClaimEntryExpiringSoon,
                    todayPoints,
                    streakDays
                }
            })

            this.bot.logger.info(
                this.bot.isMobile,
                'DASHBOARD-INFO',
                `Dashboard: ${info.userName ?? 'N/A'} | ${info.level ?? 'N/A'} | Points: ${info.availablePoints ?? 'N/A'} | Today: ${info.todayPoints ?? 'N/A'} | Streak: ${info.streakDays ?? 'N/A'} | Claim: ${info.readyToClaimPoints}`
            )

            return info as DashboardInfo
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DASHBOARD-INFO',
                `Failed to collect dashboard info: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                userName: null,
                level: null,
                availablePoints: null,
                readyToClaimPoints: 0,
                claimEntries: [],
                hasClaimEntryExpiringSoon: false,
                todayPoints: null,
                streakDays: null
            }
        }
    }
}
