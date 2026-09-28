import { EventEmitter } from 'events';
export declare class AlertingService extends EventEmitter {
    private logger;
    private slackWebhook;
    private discordWebhook;
    private alertRules;
    private alertHistory;
    private maxHistorySize;
    private rateLimitMap;
    private rateLimitWindowMs;
    constructor();
    private setupAlertRules;
    private isRateLimited;
    private getAlertId;
    checkAndAlert(eventType: string, data: any): Promise<void>;
    private getTitleForEventType;
    private getSeverityColor;
    private sendAlert;
    private sendSlackAlert;
    private sendDiscordAlert;
    getStats(): {
        totalAlerts: number;
        rules: number;
        slackConfigured: boolean;
        discordConfigured: boolean;
    };
}
export declare function getAlertingService(): AlertingService;
//# sourceMappingURL=alerting-service.d.ts.map