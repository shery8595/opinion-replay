
import { Market, Candle } from './types';

// ==================== OPINION API CONFIGURATION ====================

export const OPINION_API_BASE = 'https://openapi.opinion.trade/openapi';
export const OPINION_API_RATE_LIMIT = 15; // requests per second
export const DEFAULT_MARKET_LIMIT = 80; // Total count of candidate markets
export const PRICE_INTERVAL = '1h' as const; // Price history interval

// ==================== MOCK DATA FOR DEMO/FALLBACK ====================

const generateCandles = (startPrice: number, finalOutcome: 'YES' | 'NO', count: number): Candle[] => {
  const candles: Candle[] = [];
  let currentPrice = startPrice;
  const targetPrice = finalOutcome === 'YES' ? 0.98 : 0.02;
  const volatility = 0.03;

  for (let i = 0; i < count; i++) {
    const drift = (targetPrice - currentPrice) / (count - i);
    const noise = (Math.random() - 0.5) * volatility;
    const open = currentPrice;
    const close = Math.min(0.99, Math.max(0.01, open + drift + noise));
    const high = Math.max(open, close) + Math.random() * 0.01;
    const low = Math.min(open, close) - Math.random() * 0.01;
    const volume = Math.floor(Math.random() * 5000) + (Math.abs(noise) > 0.02 ? 10000 : 0);

    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open,
      high,
      low,
      close,
      volume
    });
    currentPrice = close;
  }
  return candles;
};

export const MOCK_MARKETS: Market[] = [
  {
    id: 'm1',
    name: 'US Presidential Election 2024',
    description: 'Will the incumbent win re-election?',
    outcome: 'NO',
    resolutionTimestamp: Date.now(),
    cutoffAt: Date.now() + 86400000 * 30, // 30 days
    candles: generateCandles(0.55, 'NO', 100),
    qualityScore: 92
  },
  {
    id: 'm2',
    name: 'BTC above $100k by Year End',
    description: 'Will Bitcoin reach a six-figure price before Jan 1st?',
    outcome: 'YES',
    resolutionTimestamp: Date.now(),
    cutoffAt: Date.now() + 86400000 * 60, // 60 days
    candles: generateCandles(0.32, 'YES', 120),
    qualityScore: 88
  },
  {
    id: 'm3',
    name: 'Mars Landing by 2030',
    description: 'Will humans set foot on Mars before the end of the decade?',
    outcome: 'NO',
    resolutionTimestamp: Date.now(),
    cutoffAt: Date.now() + 86400000 * 365 * 4, // 4 years
    candles: generateCandles(0.15, 'NO', 150),
    qualityScore: 65
  }
];

export const INITIAL_WALLET = 1000;

