import type { AxiosRequestConfig } from 'axios'
import type { MicrosoftRewardsBot } from '../../../index'
import type { Promotion } from '../../../types/AppDashboardData'

export class AppRewardTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(promotion: Promotion): Promise<void> {
        const offerId = promotion.attributes['offerid'] ?? ''
        const title = promotion.name ?? promotion.attributes['title'] ?? offerId

        try {
            if (!this.bot.accessToken) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'APP-REWARD',
                    `No access token available, skipping App Reward: ${title}`
                )
                return
            }

            this.bot.logger.info(
                this.bot.isMobile,
                'APP-REWARD',
                `Processing App Reward: ${title} | offerId=${offerId}`
            )

            const request: AxiosRequestConfig = {
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.bot.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Rewards-Country': this.bot.userData.geoLocale,
                    'X-Rewards-Language': 'en',
                    'X-Rewards-ismobile': 'true',
                    'User-Agent': 'Bing/32.5.431027001 (com.microsoft.bing; build:431027001; iOS 17.6.1) Alamofire/5.10.2'
                },
                data: {
                    amount: 1,
                    country: this.bot.userData.geoLocale,
                    id: offerId,
                    type: 100,
                    attributes: {
                        offerid: offerId
                    }
                }
            }

            const response = await this.bot.axios.request(request)
            if (response.status === 200 || response.status === 204) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'APP-REWARD',
                    `Completed App Reward: ${title} | offerId=${offerId}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'APP-REWARD',
                    `App Reward returned status ${response.status}: ${title}`
                )
            }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'APP-REWARD',
                `App Reward failed for ${title}: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
