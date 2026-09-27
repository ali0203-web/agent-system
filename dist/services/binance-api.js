"use strict";
/**
 * Binance API Service
 * Real order execution on testnet and mainnet
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceAPI = void 0;
exports.getBinanceAPI = getBinanceAPI;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../logger");
class BinanceAPI {
    constructor(apiKey, apiSecret, useTestnet = true) {
        this.logger = new logger_1.Logger('BinanceAPI');
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.useTestnet = useTestnet;
        this.baseUrl = useTestnet
            ? 'https://testnet.binance.vision/api'
            : 'https://api.binance.com/api';
    }
    /**
     * Generate HMAC SHA256 signature for requests
     */
    getSignature(queryString) {
        return crypto_1.default.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    }
    /**
     * Place a real order on Binance
     */
    async placeOrder(order) {
        try {
            const timestamp = Date.now();
            const params = {
                symbol: order.symbol,
                side: order.side,
                type: order.orderType || 'LIMIT',
                quantity: order.quantity,
                price: order.price || 0,
                timeInForce: 'GTC',
                timestamp,
            };
            // Build query string
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
            const signature = this.getSignature(queryString);
            const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`;
            this.logger.info(`📤 Placing ${order.side} order: ${order.quantity} ${order.symbol} @ ${order.price}`);
            const response = await axios_1.default.post(url, {}, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const result = {
                orderId: response.data.orderId,
                symbol: response.data.symbol,
                side: response.data.side,
                quantity: parseFloat(response.data.origQty),
                price: parseFloat(response.data.price),
                status: response.data.status,
                timestamp: response.data.transactTime,
            };
            this.logger.info(`✅ Order placed: ID ${result.orderId} | Status: ${result.status}`);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Order placement failed: ${error?.response?.data?.msg || error?.message}`);
            return null;
        }
    }
    /**
     * Get account balance
     */
    async getBalance() {
        try {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = this.getSignature(queryString);
            const url = `${this.baseUrl}/v3/account?${queryString}&signature=${signature}`;
            const response = await axios_1.default.get(url, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                },
            });
            const balances = response.data.balances.map((b) => ({
                asset: b.asset,
                free: b.free,
                locked: b.locked,
            }));
            return balances;
        }
        catch (error) {
            this.logger.error(`❌ Balance fetch failed: ${error?.message}`);
            return null;
        }
    }
    /**
     * Cancel an order
     */
    async cancelOrder(symbol, orderId) {
        try {
            const timestamp = Date.now();
            const params = {
                symbol,
                orderId,
                timestamp,
            };
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
            const signature = this.getSignature(queryString);
            const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`;
            await axios_1.default.delete(url, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                },
            });
            this.logger.info(`✅ Order ${orderId} cancelled`);
            return true;
        }
        catch (error) {
            this.logger.error(`❌ Order cancellation failed: ${error?.message}`);
            return false;
        }
    }
    /**
     * Get order status
     */
    async getOrderStatus(symbol, orderId) {
        try {
            const timestamp = Date.now();
            const params = {
                symbol,
                orderId,
                timestamp,
            };
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
            const signature = this.getSignature(queryString);
            const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`;
            const response = await axios_1.default.get(url, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                },
            });
            return {
                orderId: response.data.orderId,
                status: response.data.status,
                executedQty: parseFloat(response.data.executedQty),
                origQty: parseFloat(response.data.origQty),
            };
        }
        catch (error) {
            this.logger.error(`❌ Order status fetch failed: ${error?.message}`);
            return null;
        }
    }
}
exports.BinanceAPI = BinanceAPI;
// Export singleton instance
let binanceInstance = null;
function getBinanceAPI() {
    if (!binanceInstance) {
        const apiKey = process.env.BINANCE_TESTNET_API_KEY || process.env.BINANCE_API_KEY || '';
        const apiSecret = process.env.BINANCE_TESTNET_API_SECRET || process.env.BINANCE_API_SECRET || '';
        const useTestnet = (process.env.USE_TESTNET || 'true').toLowerCase() === 'true';
        if (!apiKey || !apiSecret) {
            throw new Error('Binance API credentials not set');
        }
        binanceInstance = new BinanceAPI(apiKey, apiSecret, useTestnet);
    }
    return binanceInstance;
}
//# sourceMappingURL=binance-api.js.map