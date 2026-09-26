import winston from 'winston'

const logLevel = process.env.LOG_LEVEL || 'info'

export class Logger {
  private logger: winston.Logger

  constructor(name: string) {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let logMessage = `[${timestamp}] [${level.toUpperCase()}] [${name}] ${message}`

          if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta, null, 2)}`
          }

          return logMessage
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    })
  }

  info(message: string, data?: any) {
    this.logger.info(message, data)
  }

  error(message: string, error?: any) {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack })
    } else {
      this.logger.error(message, error)
    }
  }

  warn(message: string, data?: any) {
    this.logger.warn(message, data)
  }

  debug(message: string, data?: any) {
    this.logger.debug(message, data)
  }
}
