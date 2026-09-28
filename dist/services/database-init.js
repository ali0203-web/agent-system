"use strict";
/**
 * Database Initialization Service
 * Sets up PostgreSQL schema and creates necessary tables
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbInit = void 0;
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../logger");
const logger = new logger_1.Logger('Database');
class DatabaseInitService {
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
    }
    async initialize() {
        try {
            logger.info('🗄️ Initializing database schema...');
            // Read schema file
            const schemaPath = path.join(__dirname, '..', 'db-schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            // Split by semicolon and execute each statement
            const statements = schema
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
            for (const statement of statements) {
                try {
                    await this.pool.query(statement);
                }
                catch (error) {
                    if (!error.message.includes('already exists')) {
                        logger.warn(`⚠️ Schema initialization warning: ${error.message}`);
                    }
                }
            }
            logger.info('✅ Database schema initialized successfully');
        }
        catch (error) {
            logger.error('❌ Failed to initialize database schema', error);
            throw error;
        }
    }
    async createSignal(agentId, agentName, signalType, data) {
        try {
            const query = `
        INSERT INTO signals (agent_id, agent_name, signal_type, confidence, message, data, symbol)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
            const values = [
                agentId,
                agentName,
                signalType,
                data.confidence || 0.5,
                data.message || '',
                JSON.stringify(data),
                data.symbol || null,
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        }
        catch (error) {
            logger.error(`Failed to save signal for ${agentId}`, error);
        }
    }
    async updateAgentMetrics(agentId, agentName, metrics) {
        try {
            const query = `
        INSERT INTO agent_metrics (
          agent_id, agent_name, total_trades, profit_loss, win_rate, 
          execution_count, success_count, error_count, last_execution
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (agent_id) 
        DO UPDATE SET
          total_trades = EXCLUDED.total_trades,
          profit_loss = EXCLUDED.profit_loss,
          win_rate = EXCLUDED.win_rate,
          execution_count = EXCLUDED.execution_count,
          success_count = EXCLUDED.success_count,
          error_count = EXCLUDED.error_count,
          last_execution = NOW()
        RETURNING *
      `;
            const values = [
                agentId,
                agentName,
                metrics.totalTrades || 0,
                metrics.profitLoss || 0,
                metrics.winRate || 0,
                metrics.executionCount || 0,
                metrics.successCount || 0,
                metrics.errorCount || 0,
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        }
        catch (error) {
            logger.error(`Failed to update metrics for ${agentId}`, error);
        }
    }
    async updateAgentStatus(agentId, agentName, status) {
        try {
            const query = `
        INSERT INTO agent_status (
          agent_id, agent_name, status, execution_time_ms, last_execution, next_execution
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (agent_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          execution_time_ms = EXCLUDED.execution_time_ms,
          last_execution = NOW(),
          next_execution = EXCLUDED.next_execution,
          updated_at = NOW()
        RETURNING *
      `;
            const values = [
                agentId,
                agentName,
                status.status || 'idle',
                status.executionTime || 0,
                status.nextExecution || null,
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        }
        catch (error) {
            logger.error(`Failed to update status for ${agentId}`, error);
        }
    }
    async getAgentSummary() {
        try {
            const query = `
        SELECT * FROM agent_summary
        ORDER BY profit_loss DESC NULLS LAST
      `;
            const result = await this.pool.query(query);
            return result.rows;
        }
        catch (error) {
            logger.error('Failed to fetch agent summary', error);
            return [];
        }
    }
    async getRecentSignals(limit = 100) {
        try {
            const query = `
        SELECT * FROM signals
        ORDER BY timestamp DESC
        LIMIT $1
      `;
            const result = await this.pool.query(query, [limit]);
            return result.rows;
        }
        catch (error) {
            logger.error('Failed to fetch signals', error);
            return [];
        }
    }
    async close() {
        await this.pool.end();
    }
}
exports.dbInit = new DatabaseInitService();
//# sourceMappingURL=database-init.js.map