import { fetchMarketDetail, fetchRecentTrades, OpinionMarketDetail, OpinionTrade } from './opinionApiClient';
import { MarketStats, Trade } from '../types/liveMarket';

/**
 * Get market statistics from Opinion API
 */
export async function getMarketStats(marketId: string): Promise<MarketStats> {
    const detail: OpinionMarketDetail = await fetchMarketDetail(marketId);

    return {
        volume24h: parseFloat(detail.volume24h),
        liquidity: parseFloat(detail.liquidity),
        traderCount: detail.traderCount,
        createdAt: detail.createdAt,
    };
}

/**
 * Get recent trades for a token
 */
export async function getRecentTrades(tokenId: string, limit: number = 20): Promise<Trade[]> {
    const trades: OpinionTrade[] = await fetchRecentTrades(tokenId, limit);

    return trades.map(trade => ({
        tokenId: trade.tokenId,
        side: trade.side,
        price: parseFloat(trade.price),
        size: parseFloat(trade.size),
        timestamp: trade.timestamp,
        trader: trade.trader,
    }));
}
