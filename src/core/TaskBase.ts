import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../index'
import type { AppDashboardData } from '../types/AppDashboardData'
import type {
    BasePromotion,
    DashboardData,
    FindClippyPromotion,
    PunchCard,
    PurplePromotionalItem
} from '../types/DashboardData'

/** Maximum number of retry cycles when activities remain incomplete after a pass */
const MAX_ACTIVITY_RETRIES = 3
/** Delay between retry cycles (ms) */
const RETRY_DELAY_MS = 5000

export class TaskBase {
    public bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    public async doDailySet(data: DashboardData, page: Page) {
        const todayKey = this.bot.utils.getFormattedDate()
        const todayData = data.dailySetPromotions[todayKey]

        let activitiesUncompleted = todayData?.filter(x => !x.complete && x.pointProgressMax > 0) ?? []

        if (!activitiesUncompleted.length) {
            this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'All "Daily Set" items have already been completed')
            return
        }

        // Unlocked: no quest limit — all Daily Set quests are processed
        const maxQuests = Infinity
        if (activitiesUncompleted.length > maxQuests) {
            this.bot.logger.warn(
                this.bot.isMobile,
                'DAILY-SET',
                `Limited to ${maxQuests} quests (${activitiesUncompleted.length} available).`
            )
            activitiesUncompleted = activitiesUncompleted.slice(0, maxQuests)
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'DAILY-SET',
            `Started solving ${activitiesUncompleted.length} "Daily Set" items`
        )

        await this.solveActivities(activitiesUncompleted, page)

        // ── Dynamic verification: re-fetch and retry incomplete activities ──
        for (let retry = 1; retry <= MAX_ACTIVITY_RETRIES; retry++) {
            await this.bot.utils.wait(RETRY_DELAY_MS)

            let freshData: DashboardData
            try {
                freshData = await this.bot.browser.func.getDashboardData()
            } catch (error) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DAILY-SET',
                    `Failed to re-fetch dashboard for verification (retry ${retry}/${MAX_ACTIVITY_RETRIES}): ${error instanceof Error ? error.message : String(error)}`
                )
                break
            }

            const freshTodayData = freshData.dailySetPromotions[todayKey]
            const stillIncomplete = freshTodayData?.filter(x => !x.complete && x.pointProgressMax > 0) ?? []

            if (stillIncomplete.length === 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'DAILY-SET',
                    `✓ Verified: all "Daily Set" items completed after pass ${retry}`,
                    'green'
                )
                return
            }

            this.bot.logger.warn(
                this.bot.isMobile,
                'DAILY-SET',
                `${stillIncomplete.length} "Daily Set" item(s) still incomplete — retrying (${retry}/${MAX_ACTIVITY_RETRIES})`
            )

            await this.solveActivities(stillIncomplete, page)
        }

        this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'Finished "Daily Set" processing (max retries reached or all done)')
    }

    public async doMorePromotions(data: DashboardData, page: Page) {
        const extractUncompleted = (d: DashboardData): BasePromotion[] => {
            const morePromotions: BasePromotion[] = [
                ...new Map(
                    [...(d.morePromotions ?? []), ...(d.morePromotionsWithoutPromotionalItems ?? [])]
                        .filter(Boolean)
                        .map(p => [p.offerId, p as BasePromotion] as const)
                ).values()
            ]

            return morePromotions.filter(x => {
                if (x.complete) return false
                if (x.pointProgressMax <= 0) return false
                if (x.exclusiveLockedFeatureStatus === 'locked') return false
                if (!x.promotionType) return false
                return true
            })
        }

        const activitiesUncompleted = extractUncompleted(data)

        if (!activitiesUncompleted.length) {
            this.bot.logger.info(
                this.bot.isMobile,
                'MORE-PROMOTIONS',
                'All "More Promotion" items have already been completed'
            )
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'MORE-PROMOTIONS',
            `Started solving ${activitiesUncompleted.length} "More Promotions" items`
        )

        await this.solveActivities(activitiesUncompleted, page)

        // ── Dynamic verification: re-fetch and retry incomplete activities ──
        for (let retry = 1; retry <= MAX_ACTIVITY_RETRIES; retry++) {
            await this.bot.utils.wait(RETRY_DELAY_MS)

            let freshData: DashboardData
            try {
                freshData = await this.bot.browser.func.getDashboardData()
            } catch (error) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'MORE-PROMOTIONS',
                    `Failed to re-fetch dashboard for verification (retry ${retry}/${MAX_ACTIVITY_RETRIES}): ${error instanceof Error ? error.message : String(error)}`
                )
                break
            }

            const stillIncomplete = extractUncompleted(freshData)

            if (stillIncomplete.length === 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'MORE-PROMOTIONS',
                    `✓ Verified: all "More Promotion" items completed after pass ${retry}`,
                    'green'
                )
                return
            }

            this.bot.logger.warn(
                this.bot.isMobile,
                'MORE-PROMOTIONS',
                `${stillIncomplete.length} "More Promotion" item(s) still incomplete — retrying (${retry}/${MAX_ACTIVITY_RETRIES})`
            )

            await this.solveActivities(stillIncomplete, page)
        }

        this.bot.logger.info(this.bot.isMobile, 'MORE-PROMOTIONS', 'Finished "More Promotions" processing (max retries reached or all done)')
    }

    public async doAppPromotions(data: AppDashboardData) {
        const extractIncomplete = (d: AppDashboardData) =>
            d.response.promotions.filter(x => {
                if (x.attributes['complete']?.toLowerCase() !== 'false') return false
                if (!x.attributes['offerid']) return false
                if (!x.attributes['type']) return false
                if (x.attributes['type'] !== 'sapphire') return false
                return true
            })

        const appRewards = extractIncomplete(data)

        if (!appRewards.length) {
            this.bot.logger.info(
                this.bot.isMobile,
                'APP-PROMOTIONS',
                'All "App Promotions" items have already been completed'
            )
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'APP-PROMOTIONS',
            `Started solving ${appRewards.length} "App Promotions" items`
        )

        for (const reward of appRewards) {
            await this.bot.activities.doAppReward(reward)
            // A delay between completing each activity
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
        }

        // ── Dynamic verification: re-fetch app data and retry incomplete ──
        for (let retry = 1; retry <= MAX_ACTIVITY_RETRIES; retry++) {
            await this.bot.utils.wait(RETRY_DELAY_MS)

            let freshAppData: AppDashboardData
            try {
                freshAppData = await this.bot.browser.func.getAppDashboardData()
            } catch (error) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'APP-PROMOTIONS',
                    `Failed to re-fetch app dashboard for verification (retry ${retry}/${MAX_ACTIVITY_RETRIES}): ${error instanceof Error ? error.message : String(error)}`
                )
                break
            }

            const stillIncomplete = extractIncomplete(freshAppData)

            if (stillIncomplete.length === 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'APP-PROMOTIONS',
                    `✓ Verified: all "App Promotions" items completed after pass ${retry}`,
                    'green'
                )
                return
            }

            this.bot.logger.warn(
                this.bot.isMobile,
                'APP-PROMOTIONS',
                `${stillIncomplete.length} "App Promotion" item(s) still incomplete — retrying (${retry}/${MAX_ACTIVITY_RETRIES})`
            )

            for (const reward of stillIncomplete) {
                await this.bot.activities.doAppReward(reward)
                await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
            }
        }

        this.bot.logger.info(this.bot.isMobile, 'APP-PROMOTIONS', 'Finished "App Promotions" processing (max retries reached or all done)')
    }

    public async doSpecialPromotions(data: DashboardData) {
        const specialPromotions: PurplePromotionalItem[] = [
            ...new Map(
                [...(data.promotionalItems ?? [])]
                    .filter(Boolean)
                    .map(p => [p.offerId, p as PurplePromotionalItem] as const)
            ).values()
        ]

        const supportedPromotions = ['ww_banner_optin_2x']

        const specialPromotionsUncompleted: PurplePromotionalItem[] =
            specialPromotions?.filter(x => {
                if (x.complete) return false
                if (x.exclusiveLockedFeatureStatus === 'locked') return false
                if (!x.promotionType) return false

                const offerId = (x.offerId ?? '').toLowerCase()
                return supportedPromotions.some(s => offerId.includes(s))
            }) ?? []

        for (const activity of specialPromotionsUncompleted) {
            try {
                const type = activity.promotionType?.toLowerCase() ?? ''
                const name = activity.name?.toLowerCase() ?? ''
                const offerId = (activity as PurplePromotionalItem).offerId

                this.bot.logger.debug(
                    this.bot.isMobile,
                    'SPECIAL-ACTIVITY',
                    `Processing activity | title="${activity.title}" | offerId=${offerId} | type=${type}"`
                )

                switch (type) {
                    // UrlReward
                    case 'urlreward': {
                        // Special "Double Search Points" activation
                        if (name.includes('ww_banner_optin_2x')) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "Double Search Points" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doDoubleSearchPoints(activity)
                        }
                        break
                    }

                    // Unsupported types
                    default: {
                        this.bot.logger.warn(
                            this.bot.isMobile,
                            'SPECIAL-ACTIVITY',
                            `Skipped activity "${activity.title}" | offerId=${offerId} | Reason: Unsupported type "${activity.promotionType}"`
                        )
                        break
                    }
                }
            } catch (error) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'SPECIAL-ACTIVITY',
                    `Error while solving activity "${activity.title}" | message=${error instanceof Error ? error.message : String(error)}`
                )
            }
        }

        this.bot.logger.info(this.bot.isMobile, 'SPECIAL-ACTIVITY', 'All "Special Activites" items have been completed')
    }

    private async solveActivities(activities: BasePromotion[], page: Page, punchCard?: PunchCard) {
        for (const activity of activities) {
            try {
                const type = activity.promotionType?.toLowerCase() ?? ''
                const name = activity.name?.toLowerCase() ?? ''
                const offerId = (activity as BasePromotion).offerId
                const destinationUrl = activity.destinationUrl?.toLowerCase() ?? ''

                this.bot.logger.info(
                    this.bot.isMobile,
                    'ACTIVITY',
                    `Processing activity | title="${activity.title}" | offerId=${offerId} | type=${type}`
                )

                // Wrap each activity in a timeout to prevent indefinite hangs
                const activityTimeout = 120_000 // 2 minutes max per activity
                const activityPromise = (async () => {
                    switch (type) {
                        // Quiz-like activities (Poll / regular quiz variants)
                        case 'quiz': {
                            const basePromotion = activity as BasePromotion

                            // Poll (usually 10 points, pollscenarioid in URL)
                            if (activity.pointProgressMax === 10 && destinationUrl.includes('pollscenarioid')) {
                                this.bot.logger.info(
                                    this.bot.isMobile,
                                    'ACTIVITY',
                                    `Found activity type "Poll" | title="${activity.title}" | offerId=${offerId}`
                                )

                                // Poll is handled via Quiz API (same underlying mechanism)
                                await this.bot.activities.doQuiz(basePromotion)
                                break
                            }

                            // All other quizzes handled via Quiz API
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "Quiz" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doQuiz(basePromotion)
                            break
                        }

                        // UrlReward
                        case 'urlreward': {
                            const basePromotion = activity as BasePromotion

                            // Search on Bing are subtypes of "urlreward"
                            if (name.includes('exploreonbing')) {
                                this.bot.logger.info(
                                    this.bot.isMobile,
                                    'ACTIVITY',
                                    `Found activity type "SearchOnBing" | title="${activity.title}" | offerId=${offerId}`
                                )

                                await this.bot.activities.doSearchOnBing(basePromotion, page)
                            } else {
                                this.bot.logger.info(
                                    this.bot.isMobile,
                                    'ACTIVITY',
                                    `Found activity type "UrlReward" | title="${activity.title}" | offerId=${offerId}`
                                )

                                await this.bot.activities.doUrlReward(basePromotion)
                            }
                            break
                        }

                        // Find Clippy specific promotion type
                        case 'findclippy': {
                            const clippyPromotion = activity as unknown as FindClippyPromotion

                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "FindClippy" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doFindClippy(clippyPromotion)
                            break
                        }

                        // Unsupported types
                        default: {
                            this.bot.logger.warn(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Skipped activity "${activity.title}" | offerId=${offerId} | Reason: Unsupported type "${activity.promotionType}"`
                            )
                            break
                        }
                    }
                })()

                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Activity timed out after ${activityTimeout / 1000}s`)),
                        activityTimeout
                    )
                )

                await Promise.race([activityPromise, timeoutPromise])

                // Cooldown
                await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
            } catch (error) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'ACTIVITY',
                    `Error while solving activity "${activity.title}" | message=${error instanceof Error ? error.message : String(error)}`
                )
            }
        }
    }
}
