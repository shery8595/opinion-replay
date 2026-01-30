/**
 * Type definitions for Live Market features
 */

import { Market } from '../types';

// Market Health Types
export type MarketHealthStatus = 'HEALTHY' | 'THIN' | 'DANGEROUS';

export interface MarketHealthMetrics {
    status: MarketHealthStatus;
    spreadPercentage: number;
    bidLiquidity: number;
    askLiquidity: number;
    volumeAcceleration: number; // percentage vs 24h avg
    lastUpdated: number;
}

// Live Price Data
export interface LivePriceData {
    price: number;
    change24h: number;
    changePercentage24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    lastUpdated: number;
}

// Orderbook Types
export interface OrderbookLevel {
    price: number;
    size: number;
    total: number; // cumulative
}

export interface OrderbookData {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    spread: number;
    spreadPercentage: number;
    timestamp: number;
}

// Market Details
export interface MarketStats {
    volume24h: number;
    liquidity: number;
    traderCount: number;
    createdAt: number;
}

// Trade Activity
export interface Trade {
    tokenId: string;
    side: 'buy' | 'sell';
    price: number;
    size: number;
    timestamp: number;
    trader?: string;
}

// Resolution Simulator Types
export interface SimulationInput {
    positionSize: number;
    side: 'YES' | 'NO';
    entryPrice: number;
}

export interface SimulationOutcome {
    resolvedAs: 'YES' | 'NO';
    pnl: number;
    pnlPercentage: number;
    exitPrice: number;
}

export interface SimulationResult {
    yesOutcome: SimulationOutcome;
    noOutcome: SimulationOutcome;
    capitalLocked: number;
    breakEvenPrice: number;
    maxLoss: number;
    maxGain: number;
    lockDurationDays: number;
}

// Shadow Trading Types
export interface ShadowSignal {
    timestamp: number;
    type: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    reason: string;
    confidence: number; // 0-1
    conditionsMet: string[];
}

export interface ShadowPosition {
    entryPrice: number;
    entryTime: number;
    size: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercentage: number;
}

export interface ShadowTradeLog {
    id: string;
    marketId: string;
    strategy: string;
    signals: ShadowSignal[];
    positions: ShadowPosition[];
    realizedPnL: number;
    winRate: number;
    totalTrades: number;
    startedAt: number;
    isActive: boolean;
}

// Collection/Series Data
export interface CollectionPeriod {
    marketId: number;
    period: string;
    startTime: number;
    endTime: number;
    startPrice?: string;
    endPrice?: string;
}

export interface CollectionData {
    title: string;
    symbol: string;
    frequency: string;
    current?: CollectionPeriod;
    next?: CollectionPeriod[];
}

// Market Intelligence
export interface VolumeAnalytics {
    total: number;
    volume24h: number;
    volume7d: number;
    growth24h: number; // percentage
    growth7d: number; // percentage
    velocity: number; // volume per day since creation
}

export interface MarketIntelligence {
    volumeAnalytics: VolumeAnalytics;
    marketAge: number; // days since creation
    daysUntilCutoff: number;
    collection?: CollectionData;
    yesLabel?: string;
    noLabel?: string;
}

// Live Market Extended Data
export interface LiveMarketData {
    market: Market;
    livePrice: LivePriceData;
    orderbook: OrderbookData;
    health: MarketHealthMetrics;
    timeToResolution: number; // seconds
    marketStats?: MarketStats; // Optional market statistics
    recentTrades?: Trade[]; // Optional recent trades
    intelligence?: MarketIntelligence; // Optional market intelligence
}
