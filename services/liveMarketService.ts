/**
 * Live Market Service
 * Handles real-time market data polling and processing
 */

import {
    fetchTokenOrderbook,
    fetchTokenPriceHistory,
    fetchLatestPrice,
    OpinionOrderbookResult,
} from './opinionApiClient';
import {
    LivePriceData,
    OrderbookData,
    MarketHealthMetrics,
    MarketHealthStatus,
    OrderbookLevel,
} from '../types/liveMarket';

/**
 * Calculate live price data from latest price API
 */
export async function getLivePriceData(tokenId: string): Promise<LivePriceData> {
    // Get current price from latest-price endpoint
    const currentPriceResponse = await fetchLatestPrice(tokenId);
    const numericPrice = parseFloat(currentPriceResponse.price);

    // Fetch 24h price history for comparison metrics
    const endAt = Math.floor(Date.now() / 1000);
    const startAt = endAt - 86400; // 24 hours ago

    const priceHistory = await fetchTokenPriceHistory(tokenId, '1h', startAt, endAt);

    if (priceHistory.length === 0) {
        // If no history, return current price with zero change
        return {
            price: numericPrice,
            change24h: 0,
            changePercentage24h: 0,
            high24h: numericPrice,
            low24h: numericPrice,
            volume24h: 0,
            lastUpdated: Date.now(),
        };
    }

    const price24hAgo = parseFloat(priceHistory[0].p);

    // Calculate 24h metrics
    const change24h = numericPrice - price24hAgo;
    const changePercentage24h = price24hAgo > 0 ? (change24h / price24hAgo) * 100 : 0;

    const prices = priceHistory.map(p => parseFloat(p.p));
    const high24h = Math.max(...prices, numericPrice);
    const low24h = Math.min(...prices, numericPrice);

    // Estimate volume (simplified - real implementation would use actual volume data)
    const volume24h = priceHistory.length * 100; // Placeholder

    return {
        price: numericPrice,
        change24h,
        changePercentage24h,
        high24h,
        low24h,
        volume24h,
        lastUpdated: Date.now(),
    };
}

/**
 * Process and normalize orderbook data
 */
export async function getOrderbookData(tokenId: string): Promise<OrderbookData> {
    const rawOrderbook: OpinionOrderbookResult = await fetchTokenOrderbook(tokenId);

    // Process bids (descending order)
    let bidTotal = 0;
    const bids: OrderbookLevel[] = rawOrderbook.bids
        .map(level => {
            const price = parseFloat(level.price);
            const size = parseFloat(level.size);
            bidTotal += size;
            return { price, size, total: bidTotal };
        })
        .sort((a, b) => b.price - a.price);

    // Process asks (ascending order)
    let askTotal = 0;
    const asks: OrderbookLevel[] = rawOrderbook.asks
        .map(level => {
            const price = parseFloat(level.price);
            const size = parseFloat(level.size);
            askTotal += size;
            return { price, size, total: askTotal };
        })
        .sort((a, b) => a.price - b.price);

    // Calculate spread
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPercentage = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    return {
        bids,
        asks,
        spread,
        spreadPercentage,
        timestamp: rawOrderbook.timestamp,
    };
}

/**
 * Calculate market health metrics
 */
export function calculateMarketHealth(
    orderbook: OrderbookData,
    volumeAcceleration: number
): MarketHealthMetrics {
    const { spreadPercentage, bids, asks } = orderbook;

    // Calculate liquidity depth (total size in top 5 levels)
    const bidLiquidity = bids.slice(0, 5).reduce((sum, level) => sum + level.size, 0);
    const askLiquidity = asks.slice(0, 5).reduce((sum, level) => sum + level.size, 0);

    // Determine health status
    let status: MarketHealthStatus;

    if (spreadPercentage < 2 && bidLiquidity > 10000 && askLiquidity > 10000) {
        status = 'HEALTHY';
    } else if (spreadPercentage < 5 && bidLiquidity > 5000 && askLiquidity > 5000) {
        status = 'THIN';
    } else {
        status = 'DANGEROUS';
    }

    return {
        status,
        spreadPercentage,
        bidLiquidity,
        askLiquidity,
        volumeAcceleration,
        lastUpdated: Date.now(),
    };
}

/**
 * Calculate volume acceleration (current vs 24h average)
 */
export async function calculateVolumeAcceleration(tokenId: string): Promise<number> {
    const endAt = Math.floor(Date.now() / 1000);
    const startAt = endAt - 86400; // 24 hours ago

    const priceHistory = await fetchTokenPriceHistory(tokenId, '1m', startAt, endAt);

    if (priceHistory.length === 0) return 0;

    // Calculate recent volume (last hour)
    const oneHourAgo = endAt - 3600;
    const recentData = priceHistory.filter(p => p.t >= oneHourAgo);
    const recentVolume = recentData.length;

    // Calculate 24h average volume per hour
    const avgHourlyVolume = priceHistory.length / 24;

    // Return acceleration as percentage
    return avgHourlyVolume > 0 ? ((recentVolume - avgHourlyVolume) / avgHourlyVolume) * 100 : 0;
}

/**
 * Calculate time to market resolution
 */
export function calculateTimeToResolution(cutoffTimestamp?: number): number {
    if (!cutoffTimestamp) return -1;

    const now = Date.now() / 1000;
    const timeRemaining = cutoffTimestamp - now;

    return Math.max(0, timeRemaining);
}
