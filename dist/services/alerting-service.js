"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertingService = void 0;
exports.getAlertingService = getAlertingService;
const events_1 = require("events");
const logger_1 = require("../logger");
class AlertingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.logger = new logger_1.Logger('AlertingService');
        this.slackWebhook = null;
        this.discordWebhook = null;
        this.alertRules = new Map();
        this.alertHistory = new Set();
        this.maxHistorySize = 1000;
        this.rateLimitMap = new Map();
        this.rateLimitWindowMs = 60000; // 1 minute
        this.slackWebhook = process.env.SLACK_WEBHOOK_URL || null;
        this.discordWebhook = process.env.DISCORD_WEBHOOK_URL || null;
        this.setupAlertRules();
    }
    setupAlertRules() {
        // Critical: Agent failed
        this.alertRules.set('agent-failed', {
            type: 'agent-failed',
            severity: 'critical',
            shouldAlert: (data) => true,
            format: (data) => `Agent ${data.agentName} failed: ${data.error}`,
        });
        // Critical: Agent high error rate (5+ consecutive failures)
        this.alertRules.set('agent-error-spike', {
            type: 'agent-error-spike',
            severity: 'critical',
            shouldAlert: (data) => data.errorCount >= 5,
            format: (data) => `High error rate on ${data.agentName}: ${data.errorCount} failures`,
        });
        // Warning: Low signal generation (expected to see signals every 5-15 min)
        this.alertRules.set('low-signal-rate', {
            type: 'low-signal-rate',
            severity: 'warning',
            shouldAlert: (data) => data.noSignalMinutes >= 30,
            format: (data) => `No signals from any agent for ${data.noSignalMinutes} minutes`,
        });
        // Warning: Portfolio risk alert
        this.alertRules.set('portfolio-risk-update', {
            type: 'portfolio-risk-update',
            severity: 'warning',
            shouldAlert: (data) => data.riskLevel === 'high' || data.riskLevel === 'critical',
            format: (data) => `Portfolio risk ${data.riskLevel.toUpperCase()}: exposure ${data.totalExposure}%`,
        });
        // Warning: Large P&L swing
        this.alertRules.set('large-pnl-swing', {
            type: 'large-pnl-swing',
            severity: 'warning',
            shouldAlert: (data) => Math.abs(data.pnlChange) > 1000,
            format: (data) => `Large P&L swing: ${data.pnlChange > 0 ? '+' : ''}$${data.pnlChange.toFixed(2)}`,
        });
        // Info: Successful trades
        this.alertRules.set('trade-closed', {
            type: 'trade-closed',
            severity: 'info',
            shouldAlert: (data) => data.pnl > 0 && data.pnl > 100,
            format: (data) => `Profitable trade closed: +$${data.pnl.toFixed(2)} (${data.agentName})`,
        });
        // Info: Major signal from top performer
        this.alertRules.set('high-confidence-signal', {
            type: 'high-confidence-signal',
            severity: 'info',
            shouldAlert: (data) => data.confidence >= 0.85 && data.agentWinRate >= 0.6,
            format: (data) => `High confidence signal (${(data.confidence * 100).toFixed(0)}%) from ${data.agentName}`,
        });
        this.logger.info(`Configured ${this.alertRules.size} alert rules`);
    }
    // Rate limit alerts to prevent spam (max 1 per rule type per minute)
    isRateLimited(ruleType) {
        const lastAlert = this.rateLimitMap.get(ruleType) || 0;
        const now = Date.now();
        if (now - lastAlert < this.rateLimitWindowMs) {
            return true;
        }
        this.rateLimitMap.set(ruleType, now);
        return false;
    }
    // Generate unique ID for alert to prevent duplicates
    getAlertId(ruleType, data) {
        return `${ruleType}-${data.agentId || 'system'}-${Math.floor(Date.now() / 5000)}`;
    }
    async checkAndAlert(eventType, data) {
        const rule = this.alertRules.get(eventType);
        if (!rule || !rule.shouldAlert(data)) {
            return;
        }
        const alertId = this.getAlertId(eventType, data);
        // Skip if already alerted recently (5 second window)
        if (this.alertHistory.has(alertId)) {
            return;
        }
        // Rate limit by severity
        if (rule.severity === 'info' && this.isRateLimited(eventType)) {
            return;
        }
        this.alertHistory.add(alertId);
        if (this.alertHistory.size > this.maxHistorySize) {
            const firstItem = this.alertHistory.values().next().value;
            if (firstItem) {
                this.alertHistory.delete(firstItem);
            }
        }
        const message = rule.format(data);
        await this.sendAlert({
            severity: rule.severity,
            title: this.getTitleForEventType(eventType),
            message,
            data,
            timestamp: Date.now(),
        });
    }
    getTitleForEventType(eventType) {
        const titles = {
            'agent-failed': '🚨 Agent Failed',
            'agent-error-spike': '⚠️ High Error Rate',
            'low-signal-rate': '📉 Low Signal Rate',
            'portfolio-risk-update': '⚠️ Portfolio Risk',
            'large-pnl-swing': '📊 Large P&L Swing',
            'trade-closed': '✅ Profitable Trade',
            'high-confidence-signal': '🎯 High Confidence Signal',
        };
        return titles[eventType] || eventType;
    }
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical':
                return '#ff0000'; // Red
            case 'warning':
                return '#ffaa00'; // Orange
            case 'info':
                return '#00d4ff'; // Cyan
            default:
                return '#888888';
        }
    }
    async sendAlert(alert) {
        // Send to Slack if configured
        if (this.slackWebhook) {
            await this.sendSlackAlert(alert);
        }
        // Send to Discord if configured
        if (this.discordWebhook) {
            await this.sendDiscordAlert(alert);
        }
        this.logger.info(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
        this.emit('alert', alert);
    }
    async sendSlackAlert(alert) {
        if (!this.slackWebhook)
            return;
        try {
            const color = this.getSeverityColor(alert.severity);
            const fields = [];
            if (alert.data.agentName) {
                fields.push({
                    title: 'Agent',
                    value: alert.data.agentName,
                    short: true,
                });
            }
            if (alert.data.symbol) {
                fields.push({
                    title: 'Symbol',
                    value: alert.data.symbol,
                    short: true,
                });
            }
            if (alert.data.pnl !== undefined) {
                fields.push({
                    title: 'P&L',
                    value: `$${alert.data.pnl.toFixed(2)}`,
                    short: true,
                });
            }
            if (alert.data.confidence !== undefined) {
                fields.push({
                    title: 'Confidence',
                    value: `${(alert.data.confidence * 100).toFixed(0)}%`,
                    short: true,
                });
            }
            const payload = {
                username: 'AgentOS Trading',
                icon_emoji: ':robot_face:',
                attachments: [
                    {
                        color,
                        title: alert.title,
                        text: alert.message,
                        fields: fields.length > 0 ? fields : undefined,
                        ts: Math.floor(alert.timestamp / 1000),
                    },
                ],
            };
            const webhook = this.slackWebhook;
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        catch (error) {
            this.logger.error(`Failed to send Slack alert: ${error}`);
        }
    }
    async sendDiscordAlert(alert) {
        if (!this.discordWebhook)
            return;
        try {
            const color = this.getSeverityColor(alert.severity);
            const colorInt = parseInt(color.replace('#', ''), 16);
            const fields = [];
            if (alert.data.agentName) {
                fields.push({
                    name: 'Agent',
                    value: alert.data.agentName,
                    inline: true,
                });
            }
            if (alert.data.symbol) {
                fields.push({
                    name: 'Symbol',
                    value: alert.data.symbol,
                    inline: true,
                });
            }
            if (alert.data.pnl !== undefined) {
                fields.push({
                    name: 'P&L',
                    value: `$${alert.data.pnl.toFixed(2)}`,
                    inline: true,
                });
            }
            const payload = {
                embeds: [
                    {
                        title: alert.title,
                        description: alert.message,
                        color: colorInt,
                        fields: fields.length > 0 ? fields : undefined,
                        timestamp: new Date(alert.timestamp).toISOString(),
                        footer: {
                            text: 'AgentOS Trading System',
                            icon_url: 'https://img.icons8.com/emoji/96/000000/robot.png',
                        },
                    },
                ],
            };
            const webhook = this.discordWebhook;
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        catch (error) {
            this.logger.error(`Failed to send Discord alert: ${error}`);
        }
    }
    // Get alert statistics
    getStats() {
        return {
            totalAlerts: this.alertHistory.size,
            rules: this.alertRules.size,
            slackConfigured: !!this.slackWebhook,
            discordConfigured: !!this.discordWebhook,
        };
    }
}
exports.AlertingService = AlertingService;
// Singleton instance
let instance = null;
function getAlertingService() {
    if (!instance) {
        instance = new AlertingService();
    }
    return instance;
}
//# sourceMappingURL=alerting-service.js.map