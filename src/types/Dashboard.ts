export type DashboardLogLevel = 'info' | 'warn' | 'error' | 'debug'
export type DashboardPlatform = 'MAIN' | 'MOBILE' | 'DESKTOP'

export interface DashboardLog {
    time: string
    userName: string
    level: DashboardLogLevel
    platform: DashboardPlatform
    title: string
    message: string
}
