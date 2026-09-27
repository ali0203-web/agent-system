/**
 * Binance API Service
 * Real order execution on testnet and mainnet
 */
interface BinanceOrder {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    orderType?: 'LIMIT' | 'MARKET';
}
interface BinanceOrderResult {
    orderId: number;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    status: string;
    timestamp: number;
}
interface BinanceBalance {
    asset: string;
    free: string;
    locked: string;
}
export declare class BinanceAPI {
    private apiKey;
    private apiSecret;
    private baseUrl;
    private logger;
    private useTestnet;
    constructor(apiKey: string, apiSecret: string, useTestnet?: boolean);
    /**
     * Generate HMAC SHA256 signature for requests
     */
    private getSignature;
    /**
     * Place a real order on Binance
     */
    placeOrder(order: BinanceOrder): Promise<BinanceOrderResult | null>;
    /**
     * Get account balance
     */
    getBalance(): Promise<BinanceBalance[] | null>;
    /**
     * Cancel an order
     */
    cancelOrder(symbol: string, orderId: number): Promise<boolean>;
    /**
     * Get order status
     */
    getOrderStatus(symbol: string, orderId: number): Promise<any | null>;
    /**
     * Get current prices from Binance (no auth needed, no rate limits)
     */
    getPrices(symbols: string[]): Promise<Record<string, number> | null>;
}
export declare function getBinanceAPI(): BinanceAPI;
export {};
//# sourceMappingURL=binance-api.d.ts.map