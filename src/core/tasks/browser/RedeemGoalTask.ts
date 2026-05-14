import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../../../index'
import type { ConfigRedeemGoal } from '../../../types/Config'
import { URLS } from '../../../automation/DashboardSelectors'

export class RedeemGoalTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(page: Page, config: ConfigRedeemGoal): Promise<void> {
        try {
            this.bot.logger.info(
                this.bot.isMobile,
                'REDEEM-GOAL',
                `Starting redeem goal | skuUrl=${config.skuUrl} | mode=${config.redeemMode}`
            )

            // Navigate to the redeem page
            await page.goto(URLS.redeem, { waitUntil: 'domcontentloaded' })
            await this.bot.utils.wait(3000)

            if (config.skuUrl) {
                // Navigate to the specific SKU page
                await page.goto(config.skuUrl, { waitUntil: 'domcontentloaded' })
                await this.bot.utils.wait(3000)

                // Select SKU option if specified
                if (config.skuOptionValue) {
                    const selected = await page.evaluate((optionValue) => {
                        const selects = document.querySelectorAll<HTMLSelectElement>('select')
                        for (const select of selects) {
                            for (const option of select.options) {
                                if (option.value === optionValue || option.textContent?.includes(optionValue)) {
                                    select.value = option.value
                                    select.dispatchEvent(new Event('change', { bubbles: true }))
                                    return true
                                }
                            }
                        }
                        return false
                    }, config.skuOptionValue)

                    if (selected) {
                        this.bot.logger.info(
                            this.bot.isMobile,
                            'REDEEM-GOAL',
                            `Selected SKU option: ${config.skuOptionValue}`
                        )
                        await this.bot.utils.wait(1500)
                    }
                }

                // Click "Set as goal" button
                const goalSet = await page.evaluate(() => {
                    const buttons = document.querySelectorAll<HTMLButtonElement>('button')
                    for (const button of buttons) {
                        const text = (button.textContent ?? '').toLowerCase()
                        if (
                            text.includes('set as goal') ||
                            text.includes('définir comme objectif') ||
                            text.includes('als ziel setzen') ||
                            text.includes('establecer como objetivo') ||
                            text.includes('goal')
                        ) {
                            const rect = button.getBoundingClientRect()
                            const style = window.getComputedStyle(button)
                            if (rect.width > 0 && rect.height > 0 && style.display !== 'none') {
                                button.click()
                                return true
                            }
                        }
                    }
                    return false
                })

                if (goalSet) {
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'REDEEM-GOAL',
                        'Successfully set redeem goal',
                        'green'
                    )
                    await this.bot.utils.wait(2000)
                } else {
                    this.bot.logger.warn(
                        this.bot.isMobile,
                        'REDEEM-GOAL',
                        'Could not find "Set as goal" button — goal may already be set'
                    )
                }

                // If auto-redeem mode, check if we can redeem
                if (config.redeemMode === 'auto') {
                    await this.tryAutoRedeem(page)
                }
            }

            // Navigate back to dashboard
            await page.goto(URLS.dashboard, { waitUntil: 'domcontentloaded' }).catch(() => {})
            await this.bot.utils.wait(1000)
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'REDEEM-GOAL',
                `Redeem goal failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async tryAutoRedeem(page: Page): Promise<void> {
        const redeemClicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll<HTMLButtonElement>('button')
            for (const button of buttons) {
                const text = (button.textContent ?? '').toLowerCase()
                if (
                    (text.includes('redeem') || text.includes('échanger') || text.includes('einlösen')) &&
                    !button.disabled
                ) {
                    const rect = button.getBoundingClientRect()
                    const style = window.getComputedStyle(button)
                    if (rect.width > 0 && rect.height > 0 && style.display !== 'none') {
                        button.click()
                        return true
                    }
                }
            }
            return false
        })

        if (redeemClicked) {
            this.bot.logger.info(
                this.bot.isMobile,
                'REDEEM-GOAL',
                'Auto-redeem initiated — confirming...',
                'green'
            )
            await this.bot.utils.wait(3000)

            // Confirm redemption dialog if present
            await page.evaluate(() => {
                const confirmButtons = document.querySelectorAll<HTMLButtonElement>('button')
                for (const button of confirmButtons) {
                    const text = (button.textContent ?? '').toLowerCase()
                    if (
                        text.includes('confirm') || text.includes('yes') ||
                        text.includes('confirmer') || text.includes('oui') ||
                        text.includes('bestätigen') || text.includes('ja')
                    ) {
                        const rect = button.getBoundingClientRect()
                        if (rect.width > 0 && rect.height > 0) {
                            button.click()
                            return true
                        }
                    }
                }
                return false
            })

            await this.bot.utils.wait(2000)
        } else {
            this.bot.logger.info(
                this.bot.isMobile,
                'REDEEM-GOAL',
                'Not enough points for auto-redeem or button not found'
            )
        }
    }
}
