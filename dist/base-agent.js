"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const database_1 = require("./database");
class BaseAgent extends events_1.EventEmitter {
    constructor() {
        super();
        this.id = (0, uuid_1.v4)();
        this.logger = new logger_1.Logger('Agent');
        this.db = new database_1.Database();
    }
    /**
     * Health check - verify agent can run
     */
    async healthCheck() {
        try {
            this.logger.debug('Running health check...');
            return true;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
    /**
     * Validate configuration
     */
    async validate() {
        try {
            this.logger.debug('Validating agent configuration...');
            if (!this.config.name) {
                throw new Error('Agent name is required');
            }
            if (!this.config.category) {
                throw new Error('Agent category is required');
            }
            const isHealthy = await this.healthCheck();
            if (!isHealthy) {
                throw new Error('Health check failed');
            }
            this.logger.info('✅ Validation passed');
            return true;
        }
        catch (error) {
            this.logger.error('❌ Validation failed:', error);
            return false;
        }
    }
    /**
     * Run agent with error handling
     */
    async run() {
        const startTime = Date.now();
        const executedAt = new Date();
        try {
            this.logger.info(`🚀 Starting execution...`);
            const data = await this.execute();
            const executionTime = Date.now() - startTime;
            const result = {
                agentId: this.id,
                agentName: this.config.name,
                success: true,
                data,
                executedAt,
                executionTime,
            };
            this.lastExecution = executedAt;
            this.lastError = undefined;
            this.logger.info(`✅ Execution completed in ${executionTime}ms`);
            // Save to database
            await this.saveResult(result);
            // Emit event
            this.emit('execution-success', result);
            return result;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const result = {
                agentId: this.id,
                agentName: this.config.name,
                success: false,
                error: errorMessage,
                executedAt,
                executionTime,
            };
            this.lastExecution = executedAt;
            this.lastError = errorMessage;
            this.logger.error(`❌ Execution failed: ${errorMessage}`);
            // Save error to database
            await this.saveResult(result);
            // Emit event
            this.emit('execution-error', result);
            throw error;
        }
    }
    /**
     * Call another agent
     */
    async callAgent(agentName, data) {
        this.logger.debug(`Calling agent: ${agentName}`);
        try {
            const agent = await this.db.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent not found: ${agentName}`);
            }
            // In production, this would execute the agent
            // For now, we'll emit an event that the orchestrator listens to
            return new Promise((resolve) => {
                this.emit('call-agent', { agentName, data, resolve });
            });
        }
        catch (error) {
            this.logger.error(`Failed to call agent ${agentName}`, error);
            throw error;
        }
    }
    /**
     * Publish event for other agents
     */
    async publishEvent(eventName, data) {
        this.logger.debug(`Publishing event: ${eventName}`);
        try {
            await this.db.publishEvent(eventName, data);
            this.emit('event-published', { eventName, data });
        }
        catch (error) {
            this.logger.error(`Failed to publish event ${eventName}`, error);
            throw error;
        }
    }
    /**
     * Subscribe to event
     */
    async subscribeToEvent(eventName, callback) {
        this.logger.debug(`Subscribing to event: ${eventName}`);
        try {
            await this.db.subscribeToEvent(eventName, callback);
            this.logger.info(`Subscribed to ${eventName}`);
        }
        catch (error) {
            this.logger.error(`Failed to subscribe to event ${eventName}`, error);
            throw error;
        }
    }
    /**
     * Save result to database
     */
    async saveResult(result) {
        try {
            await this.db.insert('agent_results', {
                ...result,
                executedAt: result.executedAt.toISOString(),
            });
        }
        catch (error) {
            this.logger.error('Failed to save result to database', error);
        }
    }
    /**
     * Get metrics
     */
    async getMetrics() {
        try {
            const results = await this.db.query(`SELECT COUNT(*) as total,
                SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
                AVG(execution_time) as avg_execution_time
         FROM agent_results
         WHERE agent_id = $1
         AND executed_at > NOW() - INTERVAL '24 hours'`, [this.id]);
            return {
                agentId: this.id,
                agentName: this.config.name,
                lastExecution: this.lastExecution,
                lastError: this.lastError,
                metrics: results.rows[0],
            };
        }
        catch (error) {
            this.logger.error('Failed to get metrics', error);
            return null;
        }
    }
    /**
     * HTTP GET request helper with retry logic for rate limiting
     */
    async get(url, headers, retries = 3) {
        let lastError;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                this.logger.debug(`GET ${url}${attempt > 0 ? ` (attempt ${attempt + 1}/${retries})` : ''}`);
                const response = await axios_1.default.get(url, {
                    headers,
                    timeout: this.config.timeout || 30000,
                });
                return response.data;
            }
            catch (error) {
                lastError = error;
                if (error.response?.status === 429 && attempt < retries - 1) {
                    const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
                    this.logger.warn(`Rate limited (429). Retrying in ${Math.round(delay / 1000)}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                else {
                    this.logger.error(`GET request failed: ${url}`, error);
                    throw error;
                }
            }
        }
        this.logger.error(`GET request failed after ${retries} attempts: ${url}`, lastError);
        throw lastError;
    }
    /**
     * HTTP POST request helper
     */
    async post(url, data, headers) {
        try {
            this.logger.debug(`POST ${url}`);
            const response = await axios_1.default.post(url, data, {
                headers,
                timeout: this.config.timeout || 30000,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error(`POST request failed: ${url}`, error);
            throw error;
        }
    }
    /**
     * Log message
     */
    log(level, message, data) {
        this.logger[level](message, data);
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=base-agent.js.map