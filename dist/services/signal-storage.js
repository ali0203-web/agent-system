"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signalStorage = void 0;
const database_init_1 = require("./database-init");
const logger_1 = require("../logger");
const logger = new logger_1.Logger('SignalStorage');
class SignalStorageService {
    constructor() {
        this.buffer = [];
        this.BATCH_SIZE = 100;
        this.FLUSH_INTERVAL = 30000; // 30 seconds
        this.flushTimer = null;
        this.startPeriodicFlush();
    }
    startPeriodicFlush() {
        this.flushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                this.flush().catch(err => logger.error('Failed to flush signals', err));
            }
        }, this.FLUSH_INTERVAL);
    }
    async addSignal(agentId, agentName, signalType, data) {
        try {
            const signal = {
                agentId,
                agentName,
                signalType,
                confidence: data.confidence || 0.5,
                message: data.message || '',
                data,
                symbol: data.symbol,
            };
            this.buffer.push(signal);
            // Flush if buffer reaches batch size
            if (this.buffer.length >= this.BATCH_SIZE) {
                await this.flush();
            }
        }
        catch (error) {
            logger.error(`Failed to buffer signal from ${agentId}`, error);
        }
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        try {
            const signals = [...this.buffer];
            this.buffer = [];
            for (const signal of signals) {
                await database_init_1.dbInit.createSignal(signal.agentId, signal.agentName, signal.signalType, {
                    ...signal.data,
                    confidence: signal.confidence,
                    message: signal.message,
                    symbol: signal.symbol,
                });
            }
            logger.info(`✅ Flushed ${signals.length} signals to database`);
        }
        catch (error) {
            logger.error('Failed to flush signals to database', error);
            // Re-add to buffer on failure
            // Don't do this to avoid memory issues - just log and move on
        }
    }
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        // Final flush
        await this.flush();
    }
    getBufferSize() {
        return this.buffer.length;
    }
}
exports.signalStorage = new SignalStorageService();
//# sourceMappingURL=signal-storage.js.map