import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../../../index'
import type { DailyStreakInfo } from '../../InternalPluginAPI'
import { URLS } from '../../../automation/DashboardSelectors'
import { RewardsSidePanelController } from '../../../automation/RewardsSidePanelController'

export class DailyStreakTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(page: Page): Promise<DailyStreakInfo | null> {
        try {
            // Navigate to dashboard if not already there
            if (!page.url().includes('rewards.bing.com')) {
                await page.goto(URLS.dashboard, { waitUntil: 'domcontentloaded' })
                await this.bot.utils.wait(2000)
            }

            const panel = new RewardsSidePanelController(page)

            // Expand the snapshot section to see streak card
            const expanded = await panel.expandDisclosure('section#snapshot')
            if (expanded) await this.bot.utils.wait(700)

            // Open the streak (fire) card
            const opened = await panel.openFirstCardByImageToken('Fire', 'section#snapshot')
            if (!opened) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DAILY-STREAK',
                    'Streak panel not found, trying to extract info from page'
                )
                return this.extractStreakFromPage(page)
            }

            await this.bot.utils.wait(1000)

            // Extract streak info from the panel
            const streakInfo = await page.evaluate(() => {
                const getText = (el: Element | null): string => el?.textContent?.trim() ?? ''

                // Look for streak day count
                let streakDays = 0
                const dayElements = document.querySelectorAll('[class*="streak"], [class*="Streak"], [role="dialog"] span, [role="dialog"] div')
                for (const el of dayElements) {
                    const text = getText(el)
                    const match = text.match(/^(\d+)$/)
                    if (match?.[1]) {
                        const num = parseInt(match[1])
                        if (num > 0 && num < 10000) {
                            const style = window.getComputedStyle(el)
                            const fontSize = parseFloat(style.fontSize)
                            if (fontSize >= 20) {
                                streakDays = num
                                break
                            }
                        }
                    }
                    // Also try "X days" pattern
                    const daysMatch = text.match(/(\d+)\s*(?:day|jour|Tag|día)s?/i)
                    if (daysMatch?.[1]) {
                        streakDays = parseInt(daysMatch[1])
                        break
                    }
                }

                // Check streak protection switch state
                let streakProtectionEnabled: boolean | null = null
                const switches = document.querySelectorAll<HTMLInputElement>('input[role="switch"]')
                for (const sw of switches) {
                    const label = sw.closest('label')
                    if (label || sw.getBoundingClientRect().width > 0) {
                        streakProtectionEnabled = sw.checked
                        break
                    }
                }

                // Extract bonus info (stars)
                let bonusText: string | null = null
                let bonusStarsFilled = 0
                let bonusStarsTotal = 0

                const progressBars = document.querySelectorAll('[role="progressbar"]')
                for (const bar of progressBars) {
                    const max = parseInt(bar.getAttribute('aria-valuemax') ?? '0')
                    const now = parseInt(bar.getAttribute('aria-valuenow') ?? '0')
                    if (max > 0) {
                        bonusStarsFilled = now
                        bonusStarsTotal = max
                        break
                    }
                }

                // Fallback: count filled/unfilled star-like icons
                if (bonusStarsTotal === 0) {
                    const filledStars = document.querySelectorAll('[class*="star"][class*="filled"], [class*="Star"][class*="active"], svg[class*="filled"]')
                    const totalStars = document.querySelectorAll('[class*="star"], [class*="Star"]')
                    if (totalStars.length > 0) {
                        bonusStarsFilled = filledStars.length
                        bonusStarsTotal = totalStars.length
                    }
                }

                // Look for bonus text
                const panels = document.querySelectorAll('[role="dialog"], .react-aria-DisclosurePanel:not([hidden])')
                for (const panelEl of panels) {
                    const allText = panelEl.textContent ?? ''
                    const bonusMatch = allText.match(/(bonus|reward|récompense)[^.]{0,80}/i)
                    if (bonusMatch) {
                        bonusText = bonusMatch[0].trim()
                        break
                    }
                }

                return {
                    streakDays,
                    streakProtectionEnabled,
                    bonusText,
                    bonusStarsFilled,
                    bonusStarsTotal
                }
            })

            // Close the streak panel
            const collapsed = await panel.collapseFirstCardByImageToken('Fire', 'section#snapshot')
            if (!collapsed) await panel.closePanel()

            this.bot.logger.info(
                this.bot.isMobile,
                'DAILY-STREAK',
                `Streak: ${streakInfo.streakDays} days | Protection: ${streakInfo.streakProtectionEnabled === null ? 'N/A' : streakInfo.streakProtectionEnabled ? 'ON' : 'OFF'} | Bonus: ${streakInfo.bonusText ?? 'N/A'} (${streakInfo.bonusStarsFilled}/${streakInfo.bonusStarsTotal} stars)`
            )

            return streakInfo
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DAILY-STREAK',
                `Failed to process daily streak: ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        }
    }

    private async extractStreakFromPage(page: Page): Promise<DailyStreakInfo | null> {
        try {
            const info = await page.evaluate(() => {
                const bodyText = document.body.innerText
                const streakMatch = bodyText.match(/(\d+)\s*(?:day|jour|Tag|día)s?\s*(?:streak|série|Serie)/i)
                return {
                    streakDays: streakMatch?.[1] ? parseInt(streakMatch[1]) : 0,
                    streakProtectionEnabled: null as boolean | null,
                    bonusText: null as string | null,
                    bonusStarsFilled: 0,
                    bonusStarsTotal: 0
                }
            })
            return info
        } catch {
            return null
        }
    }
}
