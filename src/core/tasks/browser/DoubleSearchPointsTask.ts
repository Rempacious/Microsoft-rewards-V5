import type { MicrosoftRewardsBot } from '../../../index'
import type { PurplePromotionalItem } from '../../../types/DashboardData'

export class DoubleSearchPointsTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(promotion: PurplePromotionalItem): Promise<void> {
        const offerId = promotion.offerId ?? ''
        try {
            this.bot.logger.info(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Activating Double Search Points | offerId=${offerId}`
            )

            const page = this.bot.mainMobilePage
            if (!page || page.isClosed()) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    'Browser page not available, skipping'
                )
                return
            }

            // Navigate to earn page to ensure we have the RSC data
            if (!page.url().includes('rewards.bing.com/earn')) {
                await page.goto('https://rewards.bing.com/earn', {
                    waitUntil: 'domcontentloaded'
                }).catch(() => {})
                await this.bot.utils.wait(2000)
            }

            // Try to report activity via browser
            const ok = await this.bot.browser.func.reportActivityViaBrowser(page, {
                offerId: offerId,
                hash: promotion.hash ?? '',
                destinationUrl: promotion.destinationUrl
            })

            if (ok) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    `Double Search Points activated | offerId=${offerId}`,
                    'green'
                )
            } else {
                // Fallback: navigate to destination URL directly
                if (promotion.destinationUrl) {
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'DOUBLE-SEARCH-POINTS',
                        `Server Action failed, falling back to URL navigation | offerId=${offerId}`
                    )

                    await page.goto(promotion.destinationUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 15_000
                    }).catch(() => {})
                    await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 6000))

                    // Return to earn page
                    await page.goto('https://rewards.bing.com/earn', {
                        waitUntil: 'domcontentloaded',
                        timeout: 15_000
                    }).catch(() => {})
                    await this.bot.utils.wait(2000)

                    this.bot.logger.info(
                        this.bot.isMobile,
                        'DOUBLE-SEARCH-POINTS',
                        `Double Search Points activation attempted via URL | offerId=${offerId}`,
                        'green'
                    )
                } else {
                    this.bot.logger.warn(
                        this.bot.isMobile,
                        'DOUBLE-SEARCH-POINTS',
                        `Could not activate Double Search Points | offerId=${offerId}`
                    )
                }
            }

            await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 6000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Double Search Points failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
