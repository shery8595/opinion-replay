/**
 * Mock data generators for live market features
 * Used when API key is not configured
 */

import { LivePriceData, OrderbookData, MarketHealthMetrics, OrderbookLevel } from '../types/liveMarket';

/**
 * Generate realistic mock live price data
 */
export function generateMockLivePrice(basePrice: number = 0.65): LivePriceData {
    const currentPrice = basePrice + (Math.random() - 0.5) * 0.1; // +/- 5%
    const price24hAgo = basePrice + (Math.random() - 0.5) * 0.15;

    const change24h = currentPrice - price24hAgo;
    const changePercentage24h = (change24h / price24hAgo) * 100;

    const high24h = Math.max(currentPrice, price24hAgo) + Math.random() * 0.05;
    const low24h = Math.min(currentPrice, price24hAgo) - Math.random() * 0.05;

    return {
        price: Math.max(0.01, Math.min(0.99, currentPrice)),
        change24h,
        changePercentage24h,
        high24h: Math.max(0.01, Math.min(0.99, high24h)),
        low24h: Math.max(0.01, Math.min(0.99, low24h)),
        volume24h: Math.floor(50000 + Math.random() * 150000),
        lastUpdated: Date.now(),
    };
}

/**
 * Generate realistic mock orderbook data
 */
export function generateMockOrderbook(midPrice: number = 0.65): OrderbookData {
    const spread = 0.01 + Math.random() * 0.03; // 1-4% spread
    const bestBid = midPrice - spread / 2;
    const bestAsk = midPrice + spread / 2;

    // Generate bids (descending from best bid)
    const bids: OrderbookLevel[] = [];
    let cumulativeBid = 0;
    for (let i = 0; i < 10; i++) {
        const price = bestBid - i * 0.01;
        const size = 1000 + Math.random() * 5000 + (i * 500); // Increasing size at worse prices
        cumulativeBid += size;
        bids.push({ price, size, total: cumulativeBid });
    }

    // Generate asks (ascending from best ask)
    const asks: OrderbookLevel[] = [];
    let cumulativeAsk = 0;
    for (let i = 0; i < 10; i++) {
        const price = bestAsk + i * 0.01;
        const size = 1000 + Math.random() * 5000 + (i * 500);
        cumulativeAsk += size;
        asks.push({ price, size, total: cumulativeAsk });
    }

    const spreadPercentage = (spread / midPrice) * 100;

    return {
        bids: bids.sort((a, b) => b.price - a.price),
        asks: asks.sort((a, b) => a.price - b.price),
        spread,
        spreadPercentage,
        timestamp: Math.floor(Date.now() / 1000),
    };
}

/**
 * Calculate mock market health from orderbook
 */
export function generateMockMarketHealth(orderbook: OrderbookData): MarketHealthMetrics {
    const { spreadPercentage, bids, asks } = orderbook;

    // Calculate liquidity depth (top 5 levels)
    const bidLiquidity = bids.slice(0, 5).reduce((sum, level) => sum + level.size, 0);
    const askLiquidity = asks.slice(0, 5).reduce((sum, level) => sum + level.size, 0);

    // Random volume acceleration
    const volumeAcceleration = -50 + Math.random() * 300; // -50% to +250%

    // Determine health status
    let status: 'HEALTHY' | 'THIN' | 'DANGEROUS';

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
 * Generate complete mock live market data set
 */
export function generateMockLiveMarketData(basePrice: number = 0.65) {
    const livePrice = generateMockLivePrice(basePrice);
    const orderbook = generateMockOrderbook(livePrice.price);
    const health = generateMockMarketHealth(orderbook);

    return {
        livePrice,
        orderbook,
        health,
    };
}

/**
 * Simulate live data updates by adding small variations
 */
export function updateMockLivePrice(previous: LivePriceData): LivePriceData {
    const priceChange = (Math.random() - 0.5) * 0.02; // +/- 1% change
    const newPrice = Math.max(0.01, Math.min(0.99, previous.price + priceChange));

    const change24h = newPrice - (previous.price - previous.change24h);
    const changePercentage24h = (change24h / (previous.price - previous.change24h)) * 100;

    return {
        ...previous,
        price: newPrice,
        change24h,
        changePercentage24h,
        high24h: Math.max(previous.high24h, newPrice),
        low24h: Math.min(previous.low24h, newPrice),
        lastUpdated: Date.now(),
    };
}

/**
 * Simulate orderbook updates
 */
export function updateMockOrderbook(previous: OrderbookData): OrderbookData {
    const midPrice = (previous.bids[0].price + previous.asks[0].price) / 2;

    // Small random walk in mid price
    const newMidPrice = midPrice + (Math.random() - 0.5) * 0.005;

    return generateMockOrderbook(newMidPrice);
}
