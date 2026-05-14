import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../../../index'
import type { ClaimPointsResult, ClaimEntry } from '../../InternalPluginAPI'
import { URLS } from '../../../automation/DashboardSelectors'

export class ClaimPointsTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async claim(page: Page): Promise<ClaimPointsResult> {
        try {
            // Navigate to earn page where claim cards are visible
            if (!page.url().includes('rewards.bing.com')) {
                await page.goto(URLS.earn, { waitUntil: 'domcontentloaded' })
                await this.bot.utils.wait(2000)
            }

            const pointsBefore = await this.bot.browser.func.getCurrentPoints()

            // Find and click claim buttons on the dashboard
            const claimResult = await page.evaluate(() => {
                const entries: Array<{ category: string; date: string; expiryDate: string; points: number }> = []
                let totalClaimed = 0

                // Look for claim buttons - various selectors for different dashboard layouts
                const claimSelectors = [
                    'button[class*="claim"]',
                    'button[class*="Claim"]',
                    'button[aria-label*="claim"]',
                    'button[aria-label*="Claim"]',
                    'button[aria-label*="réclamer"]',
                    'button[aria-label*="Réclamer"]',
                    'a[class*="claim"]',
                    '[data-testid*="claim"] button'
                ]

                for (const selector of claimSelectors) {
                    const buttons = document.querySelectorAll<HTMLElement>(selector)
                    for (const button of buttons) {
                        const rect = button.getBoundingClientRect()
                        const style = window.getComputedStyle(button)
                        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
                            continue
                        }

                        // Check if button text suggests it's a claim action
                        const text = (button.textContent ?? '').toLowerCase()
                        if (text.includes('claim') || text.includes('réclamer') || text.includes('reclamar') || text.includes('einlösen')) {
                            // Extract points from nearby text
                            const parent = button.closest('[class*="card"], [class*="Card"], section, article') as HTMLElement | null
                            const parentText = parent?.textContent ?? button.textContent ?? ''
                            const pointsMatch = parentText.replace(/,/g, '').match(/(\d+)\s*(?:points?|pts)/i)
                            const points = pointsMatch?.[1] ? parseInt(pointsMatch[1]) : 0

                            button.click()
                            totalClaimed += points

                            entries.push({
                                category: parentText.slice(0, 50).trim(),
                                date: new Date().toISOString(),
                                expiryDate: '',
                                points
                            })
                        }
                    }
                }

                return { totalClaimed, entries }
            })

            if (claimResult.entries.length > 0) {
                await this.bot.utils.wait(3000)

                const pointsAfter = await this.bot.browser.func.getCurrentPoints()
                const actualGain = pointsAfter - pointsBefore

                this.bot.logger.info(
                    this.bot.isMobile,
                    'CLAIM-POINTS',
                    `Claimed ${claimResult.entries.length} entries | Reported: ${claimResult.totalClaimed} pts | Actual gain: ${actualGain} pts`,
                    'green'
                )

                if (actualGain > 0) {
                    this.bot.userData.currentPoints = pointsAfter
                    this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + actualGain
                }

                return {
                    claimed: true,
                    pointsClaimed: actualGain > 0 ? actualGain : claimResult.totalClaimed,
                    entries: claimResult.entries as ClaimEntry[]
                }
            }

            this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', 'No claimable points found')
            return { claimed: false, pointsClaimed: 0, entries: [] }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'CLAIM-POINTS',
                `Failed to claim points: ${error instanceof Error ? error.message : String(error)}`
            )
            return { claimed: false, pointsClaimed: 0, entries: [] }
        }
    }
}
