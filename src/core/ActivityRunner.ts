import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../index'

// Core task imports (always available in open-source)
import { FindClippy } from './tasks/api/FindClippy'
import { Quiz } from './tasks/api/Quiz'
import { UrlReward } from './tasks/api/UrlReward'
import { Search } from './tasks/browser/Search'
import { SearchOnBing } from './tasks/browser/SearchOnBing'
import { StreakProtectionGate } from './tasks/browser/StreakProtectionGate'

// Unlocked premium task imports
import { AppRewardTask } from './tasks/api/AppRewardTask'
import { DailyCheckInTask } from './tasks/api/DailyCheckInTask'
import { ReadToEarnTask } from './tasks/api/ReadToEarnTask'
import { ClaimPointsTask } from './tasks/browser/ClaimPointsTask'
import { DailyStreakTask } from './tasks/browser/DailyStreakTask'
import { DashboardInfoCollector } from './tasks/browser/DashboardInfoCollector'
import { DoubleSearchPointsTask } from './tasks/browser/DoubleSearchPointsTask'
import { RedeemGoalTask } from './tasks/browser/RedeemGoalTask'

// Types
import type { Promotion } from '../types/AppDashboardData'
import type { ConfigRedeemGoal } from '../types/Config'
import type { BasePromotion, DashboardData, FindClippyPromotion, PurplePromotionalItem } from '../types/DashboardData'
import type { ClaimPointsResult, DailyStreakInfo, DashboardInfo, PremiumTaskMap } from './InternalPluginAPI'
import type { StreakProtectionSyncResult } from './tasks/browser/StreakProtectionGate'

export default class ActivityRunner {
    private bot: MicrosoftRewardsBot
    private premiumTasks: Partial<PremiumTaskMap> = {}

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * Install premium task implementations provided by a plugin.
     * Called by PluginManager after plugins have registered their tasks.
     */
    installPremiumTasks(tasks: Partial<PremiumTaskMap>): void {
        this.premiumTasks = { ...this.premiumTasks, ...tasks }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE TASKS (always available)
    // ═══════════════════════════════════════════════════════════════════════

    doSearch = async (data: DashboardData, page: Page, isMobile: boolean): Promise<number> => {
        const search = new Search(this.bot)
        return await search.doSearch(data, page, isMobile)
    }

    doSearchOnBing = async (promotion: BasePromotion, page: Page): Promise<void> => {
        const searchOnBing = new SearchOnBing(this.bot)
        await searchOnBing.doSearchOnBing(promotion, page)
    }

    doUrlReward = async (promotion: BasePromotion): Promise<void> => {
        const urlReward = new UrlReward(this.bot)
        await urlReward.doUrlReward(promotion)
    }

    doQuiz = async (promotion: BasePromotion): Promise<void> => {
        const quiz = new Quiz(this.bot)
        await quiz.doQuiz(promotion)
    }

    doFindClippy = async (promotion: FindClippyPromotion): Promise<void> => {
        const findClippy = new FindClippy(this.bot)
        await findClippy.doFindClippy(promotion)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PREMIUM TASKS (unlocked — full implementations)
    // ═══════════════════════════════════════════════════════════════════════

    doDoubleSearchPoints = async (promotion: PurplePromotionalItem): Promise<void> => {
        if (this.premiumTasks.doDoubleSearchPoints) {
            return this.premiumTasks.doDoubleSearchPoints(promotion)
        }
        const task = new DoubleSearchPointsTask(this.bot)
        await task.execute(promotion)
    }

    doAppReward = async (promotion: Promotion): Promise<void> => {
        if (this.premiumTasks.doAppReward) {
            return this.premiumTasks.doAppReward(promotion)
        }
        const task = new AppRewardTask(this.bot)
        await task.execute(promotion)
    }

    doReadToEarn = async (): Promise<void> => {
        if (this.premiumTasks.doReadToEarn) {
            return this.premiumTasks.doReadToEarn()
        }
        const task = new ReadToEarnTask(this.bot)
        await task.execute()
    }

    doDailyCheckIn = async (): Promise<void> => {
        if (this.premiumTasks.doDailyCheckIn) {
            return this.premiumTasks.doDailyCheckIn()
        }
        const task = new DailyCheckInTask(this.bot)
        await task.execute()
    }

    doDailyStreak = async (page: Page): Promise<DailyStreakInfo | null> => {
        if (this.premiumTasks.doDailyStreak) {
            return this.premiumTasks.doDailyStreak(page)
        }
        const task = new DailyStreakTask(this.bot)
        return task.execute(page)
    }

    doRedeemGoal = async (page: Page, config: ConfigRedeemGoal): Promise<void> => {
        if (this.premiumTasks.doRedeemGoal) {
            return this.premiumTasks.doRedeemGoal(page, config)
        }
        const task = new RedeemGoalTask(this.bot)
        await task.execute(page, config)
    }

    collectDashboardInfo = async (page: Page): Promise<DashboardInfo> => {
        if (this.premiumTasks.collectDashboardInfo) {
            return this.premiumTasks.collectDashboardInfo(page)
        }
        const collector = new DashboardInfoCollector(this.bot)
        return collector.collect(page)
    }

    doClaimPoints = async (page: Page): Promise<ClaimPointsResult> => {
        if (this.premiumTasks.doClaimPoints) {
            return this.premiumTasks.doClaimPoints(page)
        }
        const task = new ClaimPointsTask(this.bot)
        return task.claim(page)
    }

    syncStreakProtection = async (page: Page, desiredEnabled: boolean): Promise<StreakProtectionSyncResult> => {
        if (this.premiumTasks.syncStreakProtection) {
            return this.premiumTasks.syncStreakProtection(page, desiredEnabled)
        }

        const gate = new StreakProtectionGate(this.bot)
        return gate.sync(page, desiredEnabled)
    }
}
