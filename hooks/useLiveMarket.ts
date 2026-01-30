/**
 * Custom React hooks for live market data
 * Automatically falls back to mock data when API key is not configured or fails
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getLivePriceData,
    getOrderbookData,
    calculateMarketHealth,
    calculateVolumeAcceleration,
    calculateTimeToResolution,
} from '../services/liveMarketService';
import { isAPIKeyConfigured } from '../services/opinionApiClient';
import {
    generateMockLivePrice,
    generateMockOrderbook,
    generateMockMarketHealth,
    updateMockLivePrice,
    updateMockOrderbook,
} from '../utils/mockLiveData';
import {
    LivePriceData,
    OrderbookData,
    MarketHealthMetrics,
    LiveMarketData,
    MarketStats,
    Trade,
    MarketIntelligence,
    VolumeAnalytics,
} from '../types/liveMarket';
import { Market } from '../types';

/**
 * Hook for live price updates
 * Uses mock data if API key is not configured or if API fails
 */
export function useLivePrice(tokenId: string | undefined, refreshInterval = 5000) {
    const [priceData, setPriceData] = useState<LivePriceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMockDataRef = useRef(!isAPIKeyConfigured());
    const [isMockData, setIsMockData] = useState(isMockDataRef.current);

    const fetchPrice = useCallback(async () => {
        if (!tokenId) return;

        try {
            setIsLoading(true);

            if (isMockDataRef.current) {
                // Use/Continue mock data
                setPriceData(prev => {
                    if (prev) return updateMockLivePrice(prev);
                    return generateMockLivePrice(0.65);
                });
                setError(null);
            } else {
                // Use real API
                const data = await getLivePriceData(tokenId);
                setPriceData(data);
                setError(null);
            }
        } catch (err) {
            console.error('Live price error, falling back to mock:', err);

            // On API error, switch to mock data and clear error for the UI
            isMockDataRef.current = true;
            setIsMockData(true);
            setError(null);

            setPriceData(prev => {
                if (prev) return updateMockLivePrice(prev);
                return generateMockLivePrice(0.65);
            });
        } finally {
            setIsLoading(false);
        }
    }, [tokenId]); // Removed isMockData from deps to prevent infinite loop

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchPrice, refreshInterval]);

    return { priceData, isLoading, error, isMockData, refresh: fetchPrice };
}

/**
 * Hook for orderbook updates
 * Uses mock data if API key is not configured or if API fails
 */
export function useOrderbook(tokenId: string | undefined, refreshInterval = 10000) {
    const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMockDataRef = useRef(!isAPIKeyConfigured());
    const [isMockData, setIsMockData] = useState(isMockDataRef.current);

    const fetchOrderbook = useCallback(async () => {
        if (!tokenId) return;

        try {
            setIsLoading(true);

            if (isMockDataRef.current) {
                // Use/Continue mock data
                setOrderbook(prev => {
                    if (prev) return updateMockOrderbook(prev);
                    return generateMockOrderbook(0.65);
                });
                setError(null);
            } else {
                // Use real API
                const data = await getOrderbookData(tokenId);
                setOrderbook(data);
                setError(null);
            }
        } catch (err) {
            console.error('Orderbook error, falling back to mock:', err);

            // On API error, switch to mock data and clear error for the UI
            isMockDataRef.current = true;
            setIsMockData(true);
            setError(null);

            setOrderbook(prev => {
                if (prev) return updateMockOrderbook(prev);
                return generateMockOrderbook(0.65);
            });
        } finally {
            setIsLoading(false);
        }
    }, [tokenId]); // Removed isMockData from deps to prevent infinite loop

    useEffect(() => {
        fetchOrderbook();
        const interval = setInterval(fetchOrderbook, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchOrderbook, refreshInterval]);

    return { orderbook, isLoading, error, isMockData, refresh: fetchOrderbook };
}

/**
 * Combined hook for all live market data
 * Automatically uses mock data when API is unavailable or fails
 */
export function useLiveMarketData(
    market: Market | undefined,
    priceRefreshInterval = 5000,
    orderbookRefreshInterval = 10000
): {
    liveData: LiveMarketData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
    isMockData: boolean;
} {
    // Use yesTokenId for API calls, fallback to market ID for backwards compatibility
    const tokenId = market?.yesTokenId || market?.id;

    const {
        priceData,
        isLoading: priceLoading,
        error: priceError,
        isMockData: priceIsMock,
        refresh: refreshPrice
    } = useLivePrice(tokenId, priceRefreshInterval);

    const {
        orderbook,
        isLoading: orderbookLoading,
        error: orderbookError,
        isMockData: orderbookIsMock,
        refresh: refreshOrderbook
    } = useOrderbook(tokenId, orderbookRefreshInterval);

    const [health, setHealth] = useState<MarketHealthMetrics | null>(null);
    const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
    const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
    const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
    const isMockData = priceIsMock || orderbookIsMock;
    const isMockDataRef = useRef(isMockData);
    isMockDataRef.current = isMockData; // Keep ref in sync

    // Priority: Use real candle data over mock price data
    const effectivePriceData = useMemo(() => {
        // If price is mock but we have real candle data, use candles instead
        if (priceIsMock && market?.candles && market.candles.length > 0) {
            const latestCandle = market.candles[market.candles.length - 1];
            const last24Candles = market.candles.slice(-24);
            const firstCandle = last24Candles[0];
            const change24h = latestCandle.close - firstCandle.close;

            return {
                price: latestCandle.close,
                change24h,
                changePercentage24h: firstCandle.close > 0 ? (change24h / firstCandle.close) * 100 : 0,
                high24h: Math.max(...last24Candles.map(c => c.high)),
                low24h: Math.min(...last24Candles.map(c => c.low)),
                volume24h: last24Candles.reduce((sum, c) => sum + c.volume, 0),
                lastUpdated: Date.now(),
            };
        }
        // Otherwise use the API data (real or mock fallback)
        return priceData;
    }, [priceData, priceIsMock, market?.candles]);

    // Fetch market intelligence (metadata with volume and collection data)
    useEffect(() => {
        if (!market?.id || isMockDataRef.current) {
            setIntelligence(null);
            return;
        }

        const fetchIntelligence = async () => {
            try {
                const { fetchMarketDetail } = await import('../services/opinionApiClient');
                const marketDetails = await fetchMarketDetail(market.id);

                const now = Date.now();
                const createdAt = marketDetails.createdAt * 1000; // Convert to ms
                const marketAge = (now - createdAt) / (1000 * 60 * 60 * 24); // days
                const daysUntilCutoff = marketDetails.cutoffAt
                    ? (marketDetails.cutoffAt * 1000 - now) / (1000 * 60 * 60 * 24)
                    : -1;

                const totalVolume = parseFloat(marketDetails.volume || '0');
                const volume24h = parseFloat(marketDetails.volume24h || '0');
                const volume7d = parseFloat(marketDetails.volume7d || '0');

                const volumeAnalytics: VolumeAnalytics = {
                    total: totalVolume,
                    volume24h,
                    volume7d,
                    growth24h: totalVolume > 0 ? (volume24h / totalVolume) * 100 : 0,
                    growth7d: totalVolume > 0 ? (volume7d / totalVolume) * 100 : 0,
                    velocity: marketAge > 0 ? totalVolume / marketAge : 0,
                };

                const intel: MarketIntelligence = {
                    volumeAnalytics,
                    marketAge,
                    daysUntilCutoff,
                    collection: marketDetails.collection,
                    yesLabel: marketDetails.yesLabel,
                    noLabel: marketDetails.noLabel,
                };

                setIntelligence(intel);
            } catch (err) {
                console.log('Market intelligence unavailable:', err);
                setIntelligence(null);
            }
        };

        fetchIntelligence();
        const interval = setInterval(fetchIntelligence, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [market?.id]); // Removed isMockData from deps to prevent infinite loop

    // Fetch market stats and recent trades (optional features)
    useEffect(() => {
        if (!market?.id || !tokenId || isMockDataRef.current) return;

        const fetchMarketData = async () => {
            try {
                // Fetch market stats
                const { getMarketStats } = await import('../services/marketDataService');
                const stats = await getMarketStats(market.id);
                setMarketStats(stats);
            } catch (err) {
                console.log('Market stats unavailable:', err);
                setMarketStats(null);
            }

            try {
                // Fetch recent trades
                const { getRecentTrades } = await import('../services/marketDataService');
                const trades = await getRecentTrades(tokenId, 15);
                setRecentTrades(trades);
            } catch (err) {
                console.log('Recent trades unavailable:', err);
                setRecentTrades([]);
            }
        };

        fetchMarketData();
        const interval = setInterval(fetchMarketData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [market?.id, tokenId]); // Removed isMockData from deps to prevent infinite loop

    // Calculate health metrics when orderbook updates
    useEffect(() => {
        if (!orderbook) return;

        const fetchVolumeAccel = async () => {
            try {
                if (isMockDataRef.current) {
                    // Use mock health calculation
                    const healthMetrics = generateMockMarketHealth(orderbook);
                    setHealth(healthMetrics);
                } else if (tokenId) {
                    // Use real calculation
                    const accel = await calculateVolumeAcceleration(tokenId);
                    const healthMetrics = calculateMarketHealth(orderbook, accel);
                    setHealth(healthMetrics);
                }
            } catch (err) {
                console.error('Health metrics calculation error, falling back to mock:', err);
                setHealth(generateMockMarketHealth(orderbook));
            }
        };

        fetchVolumeAccel();
    }, [orderbook, tokenId]); // Removed isMockData from deps to prevent infinite loop

    const refresh = useCallback(() => {
        refreshPrice();
        refreshOrderbook();
    }, [refreshPrice, refreshOrderbook]);

    const error = priceError || orderbookError;

    if (!market || !effectivePriceData || !orderbook || !health) {
        return {
            liveData: null,
            isLoading: priceLoading || orderbookLoading,
            error,
            refresh,
            isMockData,
        };
    }

    const timeToResolution = calculateTimeToResolution(market.resolutionTimestamp);

    const liveData: LiveMarketData = {
        market,
        livePrice: effectivePriceData,
        orderbook,
        health,
        timeToResolution,
        marketStats: marketStats || undefined,
        recentTrades: recentTrades.length > 0 ? recentTrades : undefined,
        intelligence: intelligence || undefined,
    };

    return {
        liveData,
        isLoading: priceLoading || orderbookLoading,
        error: null, // Clear error if we have full liveData (even if it's mock)
        refresh,
        isMockData: priceIsMock, // Only consider price as mock if using real candles
    };
}
