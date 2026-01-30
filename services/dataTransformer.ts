/**
 * Data Transformer
 * 
 * Transforms Opinion API data into the app's Market and Candle formats
 */

import { Market, Candle } from '../types';
import { OpinionMarket, OpinionPricePoint } from './opinionApiClient';
import { getMarketImage } from '../utils/marketImages';

/**
 * Generate OHLCV candles from Opinion price history points
 * 
 * Note: Opinion's price history returns single price points per interval,
 * not actual OHLCV data. We approximate candles from these points.
 * Opinion API returns data in descending order (newest first), so we reverse it.
 * 
 * @param pricePoints Array of price points from Opinion API
 */
export function generateCandlesFromPricePoints(
    pricePoints: OpinionPricePoint[]
): Candle[] {
    if (pricePoints.length === 0) {
        return [];
    }

    // Opinion API returns newest-first, but we need oldest-first for chronological candles
    const sortedPoints = [...pricePoints].reverse();

    const candles: Candle[] = [];

    for (let i = 0; i < sortedPoints.length; i++) {
        const point = sortedPoints[i];
        const prevPoint = sortedPoints[i - 1];
        const nextPoint = sortedPoints[i + 1];

        const price = parseFloat(point.p);
        const prevPrice = prevPoint ? parseFloat(prevPoint.p) : price;
        const nextPrice = nextPoint ? parseFloat(nextPoint.p) : price;

        // Estimate OHLC from current and adjacent prices
        const open = prevPrice;
        const close = price;
        const high = Math.max(prevPrice, price, nextPrice);
        const low = Math.min(prevPrice, price, nextPrice);

        // Estimate volume based on price volatility
        const priceChange = Math.abs(close - open);
        const estimatedVolume = Math.max(1000, priceChange * 50000);

        const candle: Candle = {
            timestamp: point.t * 1000, // Convert to milliseconds
            open,
            high,
            low,
            close,
            volume: estimatedVolume,
        };

        candles.push(candle);
    }

    return candles;
}

/**
 * Determine market outcome from resolved market data
 * 
 * Opinion markets resolve by setting resultTokenId to the winning token.
 * If resultTokenId === yesTokenId, outcome is YES
 * If resultTokenId === noTokenId, outcome is NO
 */
export function determineMarketOutcome(market: OpinionMarket): 'YES' | 'NO' {
    if (!market.resultTokenId) {
        // If not resolved yet, default to YES
        return 'YES';
    }

    // Check if result matches YES token
    if (market.resultTokenId === market.yesTokenId) {
        return 'YES';
    }

    return 'NO';
}

/**
 * Calculate market quality score (0-100)
 * Based on volume, resolution status, and data completeness
 */
export function calculateMarketQuality(
    market: OpinionMarket,
    candleCount: number
): number {
    let score = 0;

    // Volume score (40 points max)
    const volume = parseFloat(market.volume || '0');
    const volumeScore = Math.min((volume / 100000) * 40, 40);
    score += volumeScore;

    // Resolution status (30 points)
    if (market.status === 4) { // Resolved
        score += 30;
    } else if (market.status === 2) { // Activated
        score += 15;
    }

    // Data completeness (30 points)
    // More candles = better quality
    const dataScore = Math.min((candleCount / 100) * 30, 30);
    score += dataScore;

    return Math.round(score);
}

/**
 * Transform Opinion market data to app's Market format
 */
export function transformOpinionMarket(
    opinionMarket: OpinionMarket,
    candles: Candle[]
): Market {
    const outcome = determineMarketOutcome(opinionMarket);
    const qualityScore = calculateMarketQuality(opinionMarket, candles.length);
    const topicId = opinionMarket.marketId.toString();

    return {
        id: topicId,
        name: opinionMarket.marketTitle,
        description: opinionMarket.rules || opinionMarket.marketTitle,
        outcome: outcome,
        candles: candles,
        resolutionTimestamp: opinionMarket.resolvedAt
            ? opinionMarket.resolvedAt * 1000 // Convert to ms
            : Date.now(),
        cutoffAt: opinionMarket.cutoffAt
            ? opinionMarket.cutoffAt * 1000 // Convert to ms
            : (opinionMarket.resolvedAt ? opinionMarket.resolvedAt * 1000 : Date.now() + 86400000 * 7),
        qualityScore: qualityScore,
        yesTokenId: opinionMarket.yesTokenId, // Preserve token ID for live data hooks
        noTokenId: opinionMarket.noTokenId,   // Preserve NO token ID for dual-stream fetching
        totalVolume: parseFloat(opinionMarket.volume || '0'),
        volume24h: parseFloat(opinionMarket.volume24h || '0'),
        volume7d: parseFloat(opinionMarket.volume7d || '0'),
        topicId: topicId,
        imageUrl: getMarketImage(topicId),
    };
}

/**
 * Validate candle data
 * Returns true if candles are valid for backtesting
 */
export function validateCandles(candles: Candle[]): boolean {
    if (candles.length < 5) {
        console.warn('Validation failed: Too few candles', candles.length);
        return false;
    }

    // Check for valid price ranges
    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        if (candle.open < 0 || candle.open > 1) {
            console.warn(`Validation failed at candle ${i}: open out of range`, candle);
            return false;
        }
        if (candle.close < 0 || candle.close > 1) {
            console.warn(`Validation failed at candle ${i}: close out of range`, candle);
            return false;
        }
        if (candle.high < 0 || candle.high > 1) {
            console.warn(`Validation failed at candle ${i}: high out of range`, candle);
            return false;
        }
        if (candle.low < 0 || candle.low > 1) {
            console.warn(`Validation failed at candle ${i}: low out of range`, candle);
            return false;
        }
        if (candle.high < Math.max(candle.open, candle.close)) {
            console.warn(`Validation failed at candle ${i}: high < max(open, close)`, candle);
            return false;
        }
        if (candle.low > Math.min(candle.open, candle.close)) {
            console.warn(`Validation failed at candle ${i}: low > min(open, close)`, candle);
            return false;
        }
    }

    // Check for reasonable timestamp progression
    for (let i = 1; i < candles.length; i++) {
        if (candles[i].timestamp <= candles[i - 1].timestamp) {
            console.warn(`Validation failed: timestamp not increasing at ${i}`, {
                prev: candles[i - 1].timestamp,
                current: candles[i].timestamp
            });
            return false;
        }
    }

    return true;
}

/**
 * Fill gaps in candle data with interpolated values
 */
export function fillCandleGaps(
    candles: Candle[],
    expectedIntervalMs: number
): Candle[] {
    if (candles.length < 2) return candles;

    const filled: Candle[] = [candles[0]];

    for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        const gap = curr.timestamp - prev.timestamp;

        // If gap is larger than expected interval, fill it
        if (gap > expectedIntervalMs * 1.5) {
            const missing = Math.floor(gap / expectedIntervalMs) - 1;

            for (let j = 1; j <= missing; j++) {
                const interpolatedPrice = prev.close + (curr.open - prev.close) * (j / (missing + 1));

                filled.push({
                    timestamp: prev.timestamp + (j * expectedIntervalMs),
                    open: interpolatedPrice,
                    high: interpolatedPrice,
                    low: interpolatedPrice,
                    close: interpolatedPrice,
                    volume: 0, // No volume for interpolated candles
                });
            }
        }

        filled.push(curr);
    }

    return filled;
}
