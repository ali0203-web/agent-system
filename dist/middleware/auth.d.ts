import { Request, Response, NextFunction } from 'express';
interface AuthenticatedRequest extends Request {
    apiKey?: string;
    clientId?: string;
}
/**
 * Main authentication middleware
 * Validates API key and enforces rate limiting
 */
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/**
 * Optional: Stricter auth for sensitive endpoints (admin operations)
 * Could be used for management endpoints
 */
export declare function requireAdminKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Clear rate limit for API key (admin only, for testing)
 */
export declare function clearRateLimit(apiKey: string): void;
/**
 * Get rate limit status for API key
 */
export declare function getRateLimitStatus(apiKey: string): {
    count: number;
    limit: number;
    resetTime: number;
    remaining: number;
    resetIn: number;
};
export {};
//# sourceMappingURL=auth.d.ts.map