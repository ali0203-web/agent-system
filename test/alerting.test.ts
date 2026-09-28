/**
 * Unit tests for AlertingService
 * Tests alert rules, rate limiting, and webhook integration
 */

import { AlertingService } from '../src/services/alerting-service'

describe('AlertingService', () => {
  let service: AlertingService

  beforeEach(() => {
    service = new AlertingService()
  })

  describe('Alert Rules', () => {
    test('should trigger agent-failed alert on agent failure', async () => {
      let alertTriggered = false
      service.on('alert', (alert) => {
        if (alert.severity === 'critical') {
          alertTriggered = true
        }
      })

      await service.checkAndAlert('agent-failed', {
        agentId: 'test-agent',
        agentName: 'test-bot',
        error: 'Connection timeout',
      })

      expect(alertTriggered).toBe(true)
    })

    test('should trigger high-error-rate alert on error spike', async () => {
      let alertTriggered = false
      service.on('alert', (alert) => {
        if (alert.title.includes('High Error Rate')) {
          alertTriggered = true
        }
      })

      await service.checkAndAlert('agent-error-spike', {
        agentName: 'test-bot',
        errorCount: 5,
      })

      expect(alertTriggered).toBe(true)
    })

    test('should trigger portfolio-risk alert on high risk', async () => {
      let alertTriggered = false
      service.on('alert', (alert) => {
        if (alert.title.includes('Portfolio Risk')) {
          alertTriggered = true
        }
      })

      await service.checkAndAlert('portfolio-risk-update', {
        riskLevel: 'high',
        totalExposure: 95,
      })

      expect(alertTriggered).toBe(true)
    })

    test('should not trigger alert when conditions not met', async () => {
      let alertTriggered = false
      service.on('alert', () => {
        alertTriggered = true
      })

      await service.checkAndAlert('large-pnl-swing', {
        pnlChange: 50, // Less than $1000 threshold
      })

      expect(alertTriggered).toBe(false)
    })
  })

  describe('Rate Limiting', () => {
    test('should allow multiple alerts within rate limit', async () => {
      let alertCount = 0
      service.on('alert', () => {
        alertCount++
      })

      // Different rule types should not interfere
      await service.checkAndAlert('agent-failed', {
        agentId: 'bot1',
        agentName: 'bot1',
        error: 'Error 1',
      })

      await service.checkAndAlert('high-confidence-signal', {
        agentName: 'bot2',
        confidence: 0.9,
        agentWinRate: 0.7,
      })

      expect(alertCount).toBe(2)
    })

    test('should deduplicate alerts within 5 second window', async () => {
      let alertCount = 0
      service.on('alert', () => {
        alertCount++
      })

      // Send same alert twice
      await service.checkAndAlert('agent-failed', {
        agentId: 'test-agent',
        agentName: 'test-bot',
        error: 'Error',
      })

      await service.checkAndAlert('agent-failed', {
        agentId: 'test-agent',
        agentName: 'test-bot',
        error: 'Error',
      })

      expect(alertCount).toBe(1)
    })
  })

  describe('Alert Statistics', () => {
    test('should track alert statistics', () => {
      const stats = service.getStats()
      expect(stats.rules).toBe(7)
      expect(stats.slackConfigured).toBe(false)
      expect(stats.discordConfigured).toBe(false)
    })
  })

  describe('Alert Formatting', () => {
    test('should format agent-failed alert correctly', async () => {
      let formattedMessage = ''
      service.on('alert', (alert) => {
        formattedMessage = alert.message
      })

      await service.checkAndAlert('agent-failed', {
        agentId: 'bot-1',
        agentName: 'momentum-trader',
        error: 'Connection refused',
      })

      expect(formattedMessage).toContain('momentum-trader')
      expect(formattedMessage).toContain('failed')
    })

    test('should format portfolio-risk alert correctly', async () => {
      let formattedAlert: any = null
      service.on('alert', (alert) => {
        formattedAlert = alert
      })

      await service.checkAndAlert('portfolio-risk-update', {
        riskLevel: 'critical',
        totalExposure: 110,
      })

      expect(formattedAlert.severity).toBe('warning')
      expect(formattedAlert.title).toContain('Risk')
    })
  })
})
