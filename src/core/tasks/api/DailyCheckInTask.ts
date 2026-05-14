import type { AxiosRequestConfig } from 'axios'
import type { MicrosoftRewardsBot } from '../../../index'

export class DailyCheckInTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(): Promise<void> {
        try {
            if (!this.bot.accessToken) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DAILY-CHECK-IN',
                    'No access token available, skipping Daily Check-In'
                )
                return
            }

            this.bot.logger.info(this.bot.isMobile, 'DAILY-CHECK-IN', 'Starting Daily Check-In')

            // Get current check-in status
            const status = await this.getCheckInStatus()
            if (!status) {
                this.bot.logger.warn(this.bot.isMobile, 'DAILY-CHECK-IN', 'Could not get check-in status')
                return
            }

            if (status.alreadyCheckedIn) {
                this.bot.logger.info(this.bot.isMobile, 'DAILY-CHECK-IN', 'Already checked in today')
                return
            }

            this.bot.logger.info(
                this.bot.isMobile,
                'DAILY-CHECK-IN',
                `Day ${status.currentDay}/7 | Points available: ${status.pointsForToday}`
            )

            // Perform check-in
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
                    id: status.offerId,
                    type: 101,
                    attributes: {
                        offerid: status.offerId
                    }
                }
            }

            const response = await this.bot.axios.request(request)
            if (response.status === 200 || response.status === 204) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'DAILY-CHECK-IN',
                    `Check-in successful! Day ${status.currentDay} | +${status.pointsForToday} points`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DAILY-CHECK-IN',
                    `Check-in returned status ${response.status}`
                )
            }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DAILY-CHECK-IN',
                `Daily Check-In failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async getCheckInStatus(): Promise<{
        offerId: string
        currentDay: number
        pointsForToday: number
        alreadyCheckedIn: boolean
    } | null> {
        try {
            const request: AxiosRequestConfig = {
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.bot.accessToken}`,
                    'X-Rewards-Country': this.bot.userData.geoLocale,
                    'X-Rewards-Language': 'en',
                    'X-Rewards-ismobile': 'true'
                }
            }

            const response = await this.bot.axios.request(request)
            const promotions = response.data?.response?.promotions ?? []

            for (const promo of promotions) {
                const attrs = promo.attributes ?? {}
                if (attrs.type === 'checkin' || attrs.offerid?.includes('DailyCheckIn')) {
                    const progress = parseInt(attrs.progress ?? '0')
                    const checkInDay = (progress % 7) + 1
                    const lastUpdated = new Date(attrs.last_updated ?? '')
                    const today = new Date()

                    const alreadyCheckedIn = lastUpdated.toDateString() === today.toDateString()
                    const pointsForToday = parseInt(attrs[`day_${checkInDay}_points`] ?? '5')

                    return {
                        offerId: attrs.offerid ?? 'Gamification_Sapphire_DailyCheckIn',
                        currentDay: checkInDay,
                        pointsForToday,
                        alreadyCheckedIn
                    }
                }
            }

            return null
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DAILY-CHECK-IN',
                `Failed to get check-in status: ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        }
    }
}
