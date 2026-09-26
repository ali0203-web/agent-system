"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const logLevel = process.env.LOG_LEVEL || 'info';
class Logger {
    constructor(name) {
        this.logger = winston_1.default.createLogger({
            level: logLevel,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                let logMessage = `[${timestamp}] [${level.toUpperCase()}] [${name}] ${message}`;
                if (Object.keys(meta).length > 0) {
                    logMessage += ` ${JSON.stringify(meta, null, 2)}`;
                }
                return logMessage;
            })),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
            ],
        });
    }
    info(message, data) {
        this.logger.info(message, data);
    }
    error(message, error) {
        if (error instanceof Error) {
            this.logger.error(message, { error: error.message, stack: error.stack });
        }
        else {
            this.logger.error(message, error);
        }
    }
    warn(message, data) {
        this.logger.warn(message, data);
    }
    debug(message, data) {
        this.logger.debug(message, data);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map