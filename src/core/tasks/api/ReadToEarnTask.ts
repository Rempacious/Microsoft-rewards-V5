import type { AxiosRequestConfig } from 'axios'
import type { MicrosoftRewardsBot } from '../../../index'

export class ReadToEarnTask {
    constructor(private readonly bot: MicrosoftRewardsBot) {}

    async execute(): Promise<void> {
        try {
            if (!this.bot.accessToken) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    'No access token available, skipping Read to Earn'
                )
                return
            }

            this.bot.logger.info(this.bot.isMobile, 'READ-TO-EARN', 'Starting Read to Earn task')

            // Get current Read to Earn status
            const status = await this.getReadToEarnStatus()
            if (!status) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    'Read to Earn not available — promotion not found (may not be supported in this region or account)'
                )
                return
            }

            if (status.isCompleted) {
                this.bot.logger.info(this.bot.isMobile, 'READ-TO-EARN', 'Read to Earn already completed today')
                return
            }

            if (status.maxPoints <= 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    'Read to Earn has 0 earnable points, skipping'
                )
                return
            }

            const maxArticles = status.maxArticles
            const currentProgress = status.currentProgress
            const remaining = maxArticles - currentProgress

            if (remaining <= 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    `Read to Earn already at max progress (${currentProgress}/${maxArticles}), skipping`
                )
                return
            }

            this.bot.logger.info(
                this.bot.isMobile,
                'READ-TO-EARN',
                `Progress: ${currentProgress}/${maxArticles} articles (${remaining} remaining) | Earnable: ${status.maxPoints - status.currentPoints} pts`
            )

            // Track points before starting to verify we're actually earning
            const pointsBefore = this.bot.userData.currentPoints
            const GRACE_ARTICLES = 3 // Number of articles to try before checking if points are being earned
            let articlesRead = 0

            // Complete each article, with early abort if not earning points
            for (let i = 0; i < remaining; i++) {
                await this.completeArticle(status.offerId, i + currentProgress + 1, maxArticles)
                articlesRead++

                // After the grace period, verify we're actually earning points
                if (articlesRead === GRACE_ARTICLES) {
                    await this.bot.utils.wait(3000) // Give the API a moment to update

                    const checkStatus = await this.getReadToEarnStatus()
                    const pointsNow = await this.bot.browser.func.getCurrentPoints()
                    const pointsGained = pointsNow - pointsBefore
                    const progressGained = checkStatus
                        ? checkStatus.currentPoints - status.currentPoints
                        : 0

                    if (pointsGained <= 0 && progressGained <= 0) {
                        this.bot.logger.warn(
                            this.bot.isMobile,
                            'READ-TO-EARN',
                            `No points earned after ${GRACE_ARTICLES} articles (points: ${pointsBefore} → ${pointsNow}, progress: ${status.currentPoints} → ${checkStatus?.currentPoints ?? '?'}) — aborting Read to Earn to save time`
                        )
                        return
                    }

                    this.bot.logger.info(
                        this.bot.isMobile,
                        'READ-TO-EARN',
                        `Points validation passed after ${GRACE_ARTICLES} articles | +${pointsGained} pts | progress: ${checkStatus?.currentPoints ?? '?'}/${status.maxPoints}`,
                        'green'
                    )
                }

                // Human-like delay between articles
                await this.bot.utils.wait(this.bot.utils.randomDelay(8000, 15000))
            }

            // Final points check
            const pointsAfter = await this.bot.browser.func.getCurrentPoints()
            const totalGained = pointsAfter - pointsBefore

            if (totalGained > 0) {
                this.bot.userData.currentPoints = pointsAfter
                this.bot.logger.info(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    `Read to Earn completed | Articles read: ${articlesRead} | Points earned: +${totalGained}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    `Read to Earn finished ${articlesRead} articles but earned 0 points — feature may not be working for this account`
                )
            }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'READ-TO-EARN',
                `Read to Earn failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async getReadToEarnStatus(): Promise<{
        offerId: string
        isCompleted: boolean
        currentProgress: number
        maxArticles: number
        maxPoints: number
        currentPoints: number
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
                if (attrs.type === 'msnreadearn' || attrs.offerid?.includes('readarticle')) {
                    const pointMax = parseInt(attrs.pointmax ?? '0')
                    const pointProgress = parseInt(attrs.pointprogress ?? '0')
                    const max = parseInt(attrs.max ?? '3')
                    const progress = parseInt(attrs.progress ?? '0')

                    return {
                        offerId: attrs.offerid ?? '',
                        isCompleted: pointProgress >= pointMax || attrs.complete?.toLowerCase() === 'true',
                        currentProgress: progress,
                        maxArticles: max,
                        maxPoints: pointMax,
                        currentPoints: pointProgress
                    }
                }
            }

            return null
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'READ-TO-EARN',
                `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        }
    }

    private async completeArticle(offerId: string, articleNumber: number, total: number): Promise<void> {
        try {
            this.bot.logger.info(
                this.bot.isMobile,
                'READ-TO-EARN',
                `Reading article ${articleNumber}/${total}...`
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
                    type: 105,
                    attributes: {
                        offerid: offerId
                    }
                }
            }

            const response = await this.bot.axios.request(request)
            if (response.status === 200 || response.status === 204) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'READ-TO-EARN',
                    `Article ${articleNumber}/${total} completed`,
                    'green'
                )
            }
        } catch (error) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'READ-TO-EARN',
                `Article ${articleNumber} failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
