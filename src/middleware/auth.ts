import { Request, Response, NextFunction } from 'express'
import { Logger } from '../logger'

const logger = new Logger('AuthMiddleware')

interface AuthenticatedRequest extends Request {
  apiKey?: string
  clientId?: string
}

// Rate limiting per API key
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100

// Valid API keys from environment or defaults (for demo)
function getValidApiKeys(): Set<string> {
  const envKeys = process.env.API_KEYS || 'default-api-key-demo,sk-demo-test-key-12345'
  return new Set(envKeys.split(',').map((k) => k.trim()))
}

/**
 * Extract API key from request
 * Supports: Authorization header, X-API-Key header, or api_key query parameter
 */
function extractApiKey(req: AuthenticatedRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key']
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader
  }

  // Check query parameter (less secure, for convenience)
  const queryKey = req.query.api_key
  if (queryKey && typeof queryKey === 'string') {
    return queryKey
  }

  return null
}

/**
 * Check rate limit for API key
 * Returns true if within limit, false if exceeded
 */
function checkRateLimit(apiKey: string): boolean {
  const now = Date.now()
  const current = rateLimitMap.get(apiKey)

  if (!current || now >= current.resetTime) {
    // New window
    rateLimitMap.set(apiKey, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  current.count++
  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  return true
}

/**
 * Main authentication middleware
 * Validates API key and enforces rate limiting
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Skip auth for health check and test endpoints
  if (req.path === '/health' || req.path === '/api/health') {
    return next()
  }

  // Skip auth for dashboard WebSocket connection
  if (req.path === '/') {
    return next()
  }

  const apiKey = extractApiKey(req)

  if (!apiKey) {
    logger.warn(`Missing API key: ${req.method} ${req.path}`)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide via Authorization header (Bearer), X-API-Key header, or api_key query parameter.',
    })
  }

  const validKeys = getValidApiKeys()
  if (!validKeys.has(apiKey)) {
    logger.warn(`Invalid API key attempted: ${req.method} ${req.path}`)
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key.',
    })
  }

  // Check rate limit
  if (!checkRateLimit(apiKey)) {
    logger.warn(`Rate limit exceeded for key ${apiKey.substring(0, 10)}...`)
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded: ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW_MS / 1000} seconds.`,
    })
  }

  // Attach API key info to request for logging
  req.apiKey = apiKey
  req.clientId = apiKey.substring(0, 10) + '...'

  // Log successful auth (sampling to avoid log spam)
  if (Math.random() < 0.1) {
    logger.debug(`Authenticated: ${req.clientId} - ${req.method} ${req.path}`)
  }

  next()
}

/**
 * Optional: Stricter auth for sensitive endpoints (admin operations)
 * Could be used for management endpoints
 */
export function requireAdminKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    logger.warn('Admin key not configured')
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin operations not available.',
    })
  }

  const apiKey = extractApiKey(req)
  if (apiKey !== adminKey) {
    logger.warn(`Unauthorized admin access attempt: ${req.method} ${req.path}`)
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions for this operation.',
    })
  }

  next()
}

/**
 * Clear rate limit for API key (admin only, for testing)
 */
export function clearRateLimit(apiKey: string): void {
  rateLimitMap.delete(apiKey)
  logger.info(`Rate limit cleared for key ${apiKey.substring(0, 10)}...`)
}

/**
 * Get rate limit status for API key
 */
export function getRateLimitStatus(apiKey: string): {
  count: number
  limit: number
  resetTime: number
  remaining: number
  resetIn: number
} {
  const now = Date.now()
  const current = rateLimitMap.get(apiKey)

  if (!current || now >= current.resetTime) {
    return {
      count: 0,
      limit: MAX_REQUESTS_PER_WINDOW,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
      remaining: MAX_REQUESTS_PER_WINDOW,
      resetIn: RATE_LIMIT_WINDOW_MS,
    }
  }

  return {
    count: current.count,
    limit: MAX_REQUESTS_PER_WINDOW,
    resetTime: current.resetTime,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - current.count),
    resetIn: current.resetTime - now,
  }
}
