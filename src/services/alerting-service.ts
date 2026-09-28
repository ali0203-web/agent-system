import { EventEmitter } from 'events'
import { Logger } from '../logger'

interface AlertRule {
  type: string
  severity: 'critical' | 'warning' | 'info'
  shouldAlert: (data: any) => boolean
  format: (data: any) => string
}

interface SlackMessage {
  channel?: string
  username: string
  icon_emoji: string
  attachments: Array<{
    color: string
    title: string
    text: string
    fields?: Array<{
      title: string
      value: string
      short?: boolean
    }>
    ts: number
  }>
}

export class AlertingService extends EventEmitter {
  private logger = new Logger('AlertingService')
  private slackWebhook: string | null = null
  private discordWebhook: string | null = null
  private alertRules: Map<string, AlertRule> = new Map()
  private alertHistory: Set<string> = new Set()
  private maxHistorySize = 1000
  private rateLimitMap: Map<string, number> = new Map()
  private rateLimitWindowMs = 60000 // 1 minute

  constructor() {
    super()
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL || null
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL || null
    this.setupAlertRules()
  }

  private setupAlertRules() {
    // Critical: Agent failed
    this.alertRules.set('agent-failed', {
      type: 'agent-failed',
      severity: 'critical',
      shouldAlert: (data) => true,
      format: (data) => `Agent ${data.agentName} failed: ${data.error}`,
    })

    // Critical: Agent high error rate (5+ consecutive failures)
    this.alertRules.set('agent-error-spike', {
      type: 'agent-error-spike',
      severity: 'critical',
      shouldAlert: (data) => data.errorCount >= 5,
      format: (data) => `High error rate on ${data.agentName}: ${data.errorCount} failures`,
    })

    // Warning: Low signal generation (expected to see signals every 5-15 min)
    this.alertRules.set('low-signal-rate', {
      type: 'low-signal-rate',
      severity: 'warning',
      shouldAlert: (data) => data.noSignalMinutes >= 30,
      format: (data) => `No signals from any agent for ${data.noSignalMinutes} minutes`,
    })

    // Warning: Portfolio risk alert
    this.alertRules.set('portfolio-risk-update', {
      type: 'portfolio-risk-update',
      severity: 'warning',
      shouldAlert: (data) => data.riskLevel === 'high' || data.riskLevel === 'critical',
      format: (data) =>
        `Portfolio risk ${data.riskLevel.toUpperCase()}: exposure ${data.totalExposure}%`,
    })

    // Warning: Large P&L swing
    this.alertRules.set('large-pnl-swing', {
      type: 'large-pnl-swing',
      severity: 'warning',
      shouldAlert: (data) => Math.abs(data.pnlChange) > 1000,
      format: (data) => `Large P&L swing: ${data.pnlChange > 0 ? '+' : ''}$${data.pnlChange.toFixed(2)}`,
    })

    // Info: Successful trades
    this.alertRules.set('trade-closed', {
      type: 'trade-closed',
      severity: 'info',
      shouldAlert: (data) => data.pnl > 0 && data.pnl > 100,
      format: (data) =>
        `Profitable trade closed: +$${data.pnl.toFixed(2)} (${data.agentName})`,
    })

    // Info: Major signal from top performer
    this.alertRules.set('high-confidence-signal', {
      type: 'high-confidence-signal',
      severity: 'info',
      shouldAlert: (data) => data.confidence >= 0.85 && data.agentWinRate >= 0.6,
      format: (data) =>
        `High confidence signal (${(data.confidence * 100).toFixed(0)}%) from ${data.agentName}`,
    })

    this.logger.info(`Configured ${this.alertRules.size} alert rules`)
  }

  // Rate limit alerts to prevent spam (max 1 per rule type per minute)
  private isRateLimited(ruleType: string): boolean {
    const lastAlert = this.rateLimitMap.get(ruleType) || 0
    const now = Date.now()

    if (now - lastAlert < this.rateLimitWindowMs) {
      return true
    }

    this.rateLimitMap.set(ruleType, now)
    return false
  }

  // Generate unique ID for alert to prevent duplicates
  private getAlertId(ruleType: string, data: any): string {
    return `${ruleType}-${data.agentId || 'system'}-${Math.floor(Date.now() / 5000)}`
  }

  async checkAndAlert(eventType: string, data: any) {
    const rule = this.alertRules.get(eventType)
    if (!rule || !rule.shouldAlert(data)) {
      return
    }

    const alertId = this.getAlertId(eventType, data)

    // Skip if already alerted recently (5 second window)
    if (this.alertHistory.has(alertId)) {
      return
    }

    // Rate limit by severity
    if (rule.severity === 'info' && this.isRateLimited(eventType)) {
      return
    }

    this.alertHistory.add(alertId)
    if (this.alertHistory.size > this.maxHistorySize) {
      const firstItem = this.alertHistory.values().next().value as string
      if (firstItem) {
        this.alertHistory.delete(firstItem)
      }
    }

    const message = rule.format(data)
    await this.sendAlert({
      severity: rule.severity,
      title: this.getTitleForEventType(eventType),
      message,
      data,
      timestamp: Date.now(),
    })
  }

  private getTitleForEventType(eventType: string): string {
    const titles: Record<string, string> = {
      'agent-failed': '🚨 Agent Failed',
      'agent-error-spike': '⚠️ High Error Rate',
      'low-signal-rate': '📉 Low Signal Rate',
      'portfolio-risk-update': '⚠️ Portfolio Risk',
      'large-pnl-swing': '📊 Large P&L Swing',
      'trade-closed': '✅ Profitable Trade',
      'high-confidence-signal': '🎯 High Confidence Signal',
    }
    return titles[eventType] || eventType
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#ff0000' // Red
      case 'warning':
        return '#ffaa00' // Orange
      case 'info':
        return '#00d4ff' // Cyan
      default:
        return '#888888'
    }
  }

  private async sendAlert(alert: {
    severity: string
    title: string
    message: string
    data: any
    timestamp: number
  }) {
    // Send to Slack if configured
    if (this.slackWebhook) {
      await this.sendSlackAlert(alert)
    }

    // Send to Discord if configured
    if (this.discordWebhook) {
      await this.sendDiscordAlert(alert)
    }

    this.logger.info(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`)
    this.emit('alert', alert)
  }

  private async sendSlackAlert(alert: {
    severity: string
    title: string
    message: string
    data: any
    timestamp: number
  }) {
    if (!this.slackWebhook) return

    try {
      const color = this.getSeverityColor(alert.severity)
      const fields = []

      if (alert.data.agentName) {
        fields.push({
          title: 'Agent',
          value: alert.data.agentName,
          short: true,
        })
      }

      if (alert.data.symbol) {
        fields.push({
          title: 'Symbol',
          value: alert.data.symbol,
          short: true,
        })
      }

      if (alert.data.pnl !== undefined) {
        fields.push({
          title: 'P&L',
          value: `$${alert.data.pnl.toFixed(2)}`,
          short: true,
        })
      }

      if (alert.data.confidence !== undefined) {
        fields.push({
          title: 'Confidence',
          value: `${(alert.data.confidence * 100).toFixed(0)}%`,
          short: true,
        })
      }

      const payload: SlackMessage = {
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
      }

      const webhook = this.slackWebhook as string
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      this.logger.error(`Failed to send Slack alert: ${error}`)
    }
  }

  private async sendDiscordAlert(alert: {
    severity: string
    title: string
    message: string
    data: any
    timestamp: number
  }) {
    if (!this.discordWebhook) return

    try {
      const color = this.getSeverityColor(alert.severity)
      const colorInt = parseInt(color.replace('#', ''), 16)

      const fields = []

      if (alert.data.agentName) {
        fields.push({
          name: 'Agent',
          value: alert.data.agentName,
          inline: true,
        })
      }

      if (alert.data.symbol) {
        fields.push({
          name: 'Symbol',
          value: alert.data.symbol,
          inline: true,
        })
      }

      if (alert.data.pnl !== undefined) {
        fields.push({
          name: 'P&L',
          value: `$${alert.data.pnl.toFixed(2)}`,
          inline: true,
        })
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
      }

      const webhook = this.discordWebhook as string
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      this.logger.error(`Failed to send Discord alert: ${error}`)
    }
  }

  // Get alert statistics
  getStats() {
    return {
      totalAlerts: this.alertHistory.size,
      rules: this.alertRules.size,
      slackConfigured: !!this.slackWebhook,
      discordConfigured: !!this.discordWebhook,
    }
  }
}

// Singleton instance
let instance: AlertingService | null = null

export function getAlertingService(): AlertingService {
  if (!instance) {
    instance = new AlertingService()
  }
  return instance
}
