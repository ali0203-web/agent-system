"use strict";
/**
 * Database Initialization Service
 * Sets up PostgreSQL schema and creates necessary tables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbInit = void 0;
const pg_1 = require("pg");
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
            // Inline schema to ensure it always exists
            const schema = `
        CREATE TABLE IF NOT EXISTS signals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(255) NOT NULL,
          agent_name VARCHAR(255),
          symbol VARCHAR(50),
          signal_type VARCHAR(100),
          confidence FLOAT,
          message TEXT,
          data JSONB,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS trades (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          entry_price FLOAT,
          exit_price FLOAT,
          position_size FLOAT,
          profit_loss FLOAT,
          status VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          closed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS agent_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(255) UNIQUE NOT NULL,
          agent_name VARCHAR(255),
          total_trades INT DEFAULT 0,
          profit_loss FLOAT DEFAULT 0,
          win_rate FLOAT DEFAULT 0,
          execution_count INT DEFAULT 0,
          success_count INT DEFAULT 0,
          error_count INT DEFAULT 0,
          last_execution TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS agent_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(255) UNIQUE NOT NULL,
          agent_name VARCHAR(255),
          status VARCHAR(50),
          execution_time_ms INT,
          last_execution TIMESTAMPTZ,
          next_execution TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS dashboard_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(100),
          agent_id VARCHAR(255),
          agent_name VARCHAR(255),
          data JSONB,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_signals_agent_id ON signals(agent_id);
        CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
        CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
        CREATE INDEX IF NOT EXISTS idx_trades_agent_id ON trades(agent_id);
        CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
        CREATE INDEX IF NOT EXISTS idx_dashboard_events_type ON dashboard_events(type);
        CREATE INDEX IF NOT EXISTS idx_dashboard_events_timestamp ON dashboard_events(timestamp);
      `;
            // Split by semicolon and execute each statement
            const statements = schema
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
            logger.info(`📋 Executing ${statements.length} schema statements...`);
            for (const statement of statements) {
                try {
                    await this.pool.query(statement);
                }
                catch (error) {
                    if (!error.message.includes('already exists')) {
                        logger.warn(`⚠️ Schema statement: ${error.message}`);
                    }
                }
            }
            logger.info('✅ Database schema initialized successfully');
        }
        catch (error) {
            logger.error('❌ Failed to initialize database schema', error);
            // Don't throw - allow app to continue even if schema init fails
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