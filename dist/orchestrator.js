"use strict";
/**
 * Orchestrator System
 * Manages all agents, coordinates event flow, and handles inter-agent communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrator = exports.Orchestrator = void 0;
const events_1 = require("events");
const bitcoin_price_monitor_1 = require("./agents/bitcoin-price-monitor");
const portfolio_tracker_1 = require("./agents/portfolio-tracker");
const pump_dump_detector_1 = require("./agents/pump-dump-detector");
const logger_1 = require("./logger");
class Orchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.logger = new logger_1.Logger('Orchestrator');
        this.timers = new Map();
        this.running = false;
        this.registerAgents();
    }
    /**
     * Register all agents
     */
    registerAgents() {
        this.logger.info('📋 Registering agents...');
        // Agent #1: Bitcoin Price Monitor
        const bitcoinAgent = new bitcoin_price_monitor_1.BitcoinPriceMonitor();
        this.register('bitcoin-monitor', bitcoinAgent, bitcoinAgent.config.schedule || '*/5 * * * *');
        // Agent #2: Portfolio Tracker
        const portfolioAgent = new portfolio_tracker_1.PortfolioTracker();
        this.register('portfolio-tracker', portfolioAgent, portfolioAgent.config.schedule || '*/15 * * * *');
        // Agent #3: Pump & Dump Detector
        const pumpDumpAgent = new pump_dump_detector_1.PumpDumpDetector();
        this.register('pump-dump-detector', pumpDumpAgent, pumpDumpAgent.config.schedule || '*/5 * * * *');
        this.logger.info(`✅ Registered ${this.agents.size} agents`);
    }
    /**
     * Register an agent
     */
    register(id, instance, schedule) {
        this.agents.set(id, {
            id,
            name: instance.config.name,
            instance,
            schedule,
            isRunning: false,
        });
        this.logger.info(`  ✓ ${instance.config.name}`);
        // Setup event listeners for inter-agent communication
        this.setupEventListeners(instance, id);
    }
    /**
     * Setup event listeners for agent communication
     */
    setupEventListeners(agent, agentId) {
        agent.on('bitcoin-price-alert', (data) => {
            this.logger.warn(`🚨 [${agentId}] Bitcoin price alert:`, data);
            this.emit('bitcoin-price-alert', data);
        });
        agent.on('pump-dump-signal', (data) => {
            this.logger.warn(`🚨 [${agentId}] Pump/Dump signal:`, data);
            this.emit('pump-dump-signal', data);
        });
        agent.on('portfolio-updated', (data) => {
            this.logger.info(`💼 [${agentId}] Portfolio updated`, data);
            this.emit('portfolio-updated', data);
        });
        agent.on('portfolio-alert', (data) => {
            this.logger.warn(`⚠️  [${agentId}] Portfolio alert:`, data);
            this.emit('portfolio-alert', data);
        });
    }
    /**
     * Start the orchestrator
     */
    async start() {
        if (this.running) {
            this.logger.warn('Orchestrator is already running');
            return;
        }
        this.running = true;
        this.logger.info('🚀 Starting Orchestrator...');
        // Run all agents immediately on start
        await this.runAllAgents();
        // Schedule agents
        this.scheduleAgents();
        this.logger.info(`✅ Orchestrator started with ${this.agents.size} agents`);
        this.emit('started');
    }
    /**
     * Run all agents once immediately
     */
    async runAllAgents() {
        const promises = [];
        for (const [id, registry] of this.agents) {
            promises.push(this.runAgent(id));
        }
        await Promise.allSettled(promises);
    }
    /**
     * Run a single agent
     */
    async runAgent(agentId) {
        const registry = this.agents.get(agentId);
        if (!registry) {
            this.logger.error(`Agent not found: ${agentId}`);
            return;
        }
        if (registry.isRunning) {
            this.logger.debug(`Agent already running: ${registry.name}`);
            return;
        }
        try {
            registry.isRunning = true;
            registry.lastRun = new Date();
            this.logger.info(`▶️  Running: ${registry.name}`);
            const startTime = Date.now();
            const result = await registry.instance.run();
            const duration = Date.now() - startTime;
            this.logger.info(`✅ ${registry.name} completed in ${duration}ms`);
            this.emit('agent-completed', {
                agentId,
                agentName: registry.name,
                success: result.data?.success !== false,
                duration,
                timestamp: new Date(),
            });
        }
        catch (error) {
            this.logger.error(`❌ ${registry.name} failed`, error);
            this.emit('agent-failed', {
                agentId,
                agentName: registry.name,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            });
        }
        finally {
            registry.isRunning = false;
        }
    }
    /**
     * Schedule agents based on cron expressions
     */
    scheduleAgents() {
        const schedule = require('node-schedule');
        for (const [id, registry] of this.agents) {
            const job = schedule.scheduleJob(registry.schedule, async () => {
                await this.runAgent(id);
            });
            this.timers.set(id, job);
            this.logger.info(`📅 Scheduled ${registry.name}: ${registry.schedule}`);
        }
    }
    /**
     * Get orchestrator status
     */
    getStatus() {
        const agents = [];
        for (const [id, registry] of this.agents) {
            agents.push({
                id: registry.id,
                name: registry.name,
                schedule: registry.schedule,
                isRunning: registry.isRunning,
                lastRun: registry.lastRun,
                nextRun: registry.nextRun,
            });
        }
        return {
            isRunning: this.running,
            agentCount: this.agents.size,
            agents,
            timestamp: new Date(),
        };
    }
    /**
     * Get metrics for all agents
     */
    async getMetrics() {
        const metrics = [];
        for (const [id, registry] of this.agents) {
            const agentMetrics = await registry.instance.getMetrics();
            metrics.push({
                agentId: id,
                agentName: registry.name,
                ...agentMetrics,
            });
        }
        return {
            orchestratorStatus: this.getStatus(),
            agentMetrics: metrics,
            timestamp: new Date(),
        };
    }
    /**
     * Stop the orchestrator
     */
    async stop() {
        this.logger.info('🛑 Stopping Orchestrator...');
        // Clear all timers
        for (const timer of this.timers.values()) {
            if (timer) {
                clearInterval(timer);
            }
        }
        this.timers.clear();
        this.running = false;
        this.logger.info('✅ Orchestrator stopped');
        this.emit('stopped');
    }
}
exports.Orchestrator = Orchestrator;
// Export singleton
exports.orchestrator = new Orchestrator();
//# sourceMappingURL=orchestrator.js.map