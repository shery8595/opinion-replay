/**
 * Opinion API Client
 * 
 * Handles all API requests to the Opinion OpenAPI
 * Base URL: https://openapi.opinion.trade/openapi
 * Rate Limit: 15 requests/second
 */

// Opinion API Response Types
export interface OpinionAPIResponse<T> {
  code: number;
  msg: string;
  result: T;
}

export interface OpinionMarket {
  marketId: number;
  marketTitle: string;
  status: number; // 1=Created, 2=Activated, 3=Resolving, 4=Resolved, 5=Failed, 6=Deleted
  statusEnum: 'Created' | 'Activated' | 'Resolving' | 'Resolved' | 'Failed' | 'Deleted';
  marketType: number; // 0=Binary, 1=Categorical
  yesLabel?: string;
  noLabel?: string;
  rules?: string;
  yesTokenId?: string;
  noTokenId?: string;
  conditionId?: string;
  resultTokenId?: string;
  volume: string;
  volume24h?: string;
  volume7d?: string;
  quoteToken: string;
  chainId: string;
  questionId?: string;
  createdAt: number;
  cutoffAt?: number;
  resolvedAt?: number;
  collection?: {
    title: string;
    symbol: string;
    frequency: string;
    current?: any;
    next?: any[];
  };
  childMarkets?: any[];
}

export interface OpinionMarketListResult {
  total: number;
  list: OpinionMarket[];
}

export interface OpinionPricePoint {
  t: number; // Unix timestamp in seconds
  p: string; // Price
}

export interface OpinionPriceHistoryResult {
  history: OpinionPricePoint[];
}

export interface OpinionOrderbookLevel {
  price: string;
  size: string;
}

export interface OpinionOrderbookResult {
  market: string;
  tokenId: string;
  timestamp: number;
  bids: OpinionOrderbookLevel[];
  asks: OpinionOrderbookLevel[];
}

export interface OpinionLatestPriceResult {
  tokenId: string;
  price: string;
  side: string;
  size: string;
  timestamp: number;
}

export interface OpinionMarketDetail extends OpinionMarket {
  id: string; // Dashboard ID string
  title: string;
  description: string;
  liquidity: string;
  traderCount: number;
}

export interface OpinionTrade {
  tokenId: string;
  side: 'buy' | 'sell';
  price: string;
  size: string;
  timestamp: number;
  trader?: string;
}

// Configuration
const OPINION_API_BASE = 'https://openapi.opinion.trade/openapi';
const API_KEY = (import.meta.env.VITE_OPINION_API_KEY || '').trim();

/**
 * Check if API key is configured and valid (not a placeholder)
 */
export function isAPIKeyConfigured(): boolean {
  const key = API_KEY.trim();
  if (!key) return false;

  // Check for common placeholders
  const placeholders = [
    'your_api_key',
    'replace_with_your_api_key',
    'enter_api_key_here',
    'api_key',
    'VITE_OPINION_API_KEY'
  ];

  return !placeholders.some(p => key.toLowerCase().includes(p.toLowerCase()));
}

/**
 * Check if API key is configured
 */
export async function fetchOpinionAPI<T>(endpoint: string): Promise<T> {
  const url = `${OPINION_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Opinion API Error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();

  // Error handling for Opinion API specifics
  const errorCode = data.errno ?? data.code;
  const errorMsg = data.errmsg ?? data.msg;
  const hasError = errorCode !== undefined && errorCode !== 0;
  const hasResult = 'result' in data;

  if (hasError) {
    const errorMessage = errorMsg || `Unknown API Error (Code: ${errorCode})`;
    console.error('Opinion API error reported:', { code: errorCode, msg: errorMsg, fullData: data });
    throw new Error(`Opinion API Error: ${errorMessage}`);
  }

  // Case 1: Has result field (standard wrapped response)
  if (hasResult) {
    return data.result;
  }

  // Case 2: Data is the result itself
  return data as T;
}

/**
 * Fetch active markets from Opinion for live simulation
 * Active markets have ongoing price data, ideal for paper trading simulation
 * @param limit Number of markets to fetch (max 20)
 */
export async function fetchResolvedMarkets(limit: number = 20): Promise<OpinionMarket[]> {
  const result = await fetchOpinionAPI<OpinionMarketListResult>(
    `/market?status=activated&limit=${Math.min(limit, 100)}&sortBy=3&marketType=0`
  );

  return result.list;
}

/**
 * Fetch detailed market information
 * @param marketId Market ID
 */
export async function fetchMarketDetails(marketId: number): Promise<OpinionMarket> {
  const result = await fetchOpinionAPI<{ data: OpinionMarket }>(`/market/${marketId}`);
  return result.data;
}

/**
 * Fetch full market details including collection/series data
 * @param marketId Market ID (supports both binary and categorical)
 */
export async function fetchMarketFullDetails(marketId: number): Promise<OpinionMarket> {
  try {
    // Try binary endpoint first
    const result = await fetchOpinionAPI<{ data: OpinionMarket }>(`/market/${marketId}`);
    return result.data;
  } catch (err) {
    // Fallback to categorical endpoint if binary fails
    const result = await fetchOpinionAPI<{ data: OpinionMarket }>(`/market/categorical/${marketId}`);
    return result.data;
  }
}

/**
 * Fetch historical price data for a token
 * @param tokenId Token ID (YES or NO token)
 * @param interval Price interval: 1m, 1h, 1d, 1w, max
 * @param startAt Optional start timestamp (Unix seconds)
 * @param endAt Optional end timestamp (Unix seconds)
 */
export async function fetchTokenPriceHistory(
  tokenId: string,
  interval: '1m' | '1h' | '1d' | '1w' | 'max' = '1m',
  startAt?: number,
  endAt?: number
): Promise<OpinionPricePoint[]> {
  let endpoint = `/token/price-history?token_id=${tokenId}&interval=${interval}`;

  if (startAt) {
    endpoint += `&start_at=${startAt}`;
  }

  if (endAt) {
    endpoint += `&end_at=${endAt}`;
  }

  const result = await fetchOpinionAPI<OpinionPriceHistoryResult>(endpoint);
  return result.history;
}

/**
 * Fetch latest price for a token
 */
export async function fetchLatestPrice(tokenId: string): Promise<OpinionLatestPriceResult> {
  return fetchOpinionAPI<OpinionLatestPriceResult>(`/token/latest-price?token_id=${tokenId}`);
}

/**
 * Fetch detailed market information
 */
export async function fetchMarketDetail(marketId: string): Promise<OpinionMarketDetail> {
  return fetchOpinionAPI<OpinionMarketDetail>(`/market/detail?market_id=${marketId}`);
}

/**
 * Fetch recent trades for a token
 */
export async function fetchRecentTrades(tokenId: string, limit: number = 20): Promise<OpinionTrade[]> {
  const result = await fetchOpinionAPI<{ trades: OpinionTrade[] }>(`/token/trades?token_id=${tokenId}&limit=${limit}`);
  return result.trades || [];
}

/**
 * Fetch current orderbook for a token
 * @param tokenId Token ID
 */
export async function fetchTokenOrderbook(tokenId: string): Promise<OpinionOrderbookResult> {
  const result = await fetchOpinionAPI<OpinionOrderbookResult>(
    `/token/orderbook?token_id=${tokenId}`
  );
  return result;
}

/**
 * Fetch market details by token ID
 * @param tokenId Token ID
 */
export async function getMarketByToken(tokenId: string): Promise<OpinionMarket | null> {
  try {
    const result = await fetchOpinionAPI<OpinionMarketListResult>(
      `/market?token_id=${tokenId}`
    );
    return result.list?.[0] || null;
  } catch (err) {
    console.error(`Error fetching market for token ${tokenId}:`, err);
    return null;
  }
}

// ============================================
// Market Analytics API Functions
// ============================================

/**
 * Sort options for market listing
 * 1 = Created At (desc), 2 = Activated At (desc), 3 = Volume (Total), 
 * 4 = Volume 7d, 5 = Volume 24h, 6 = Cutoff At (asc - closing soon first)
 */
export type MarketSortBy = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Fetch active markets with custom sorting
 * @param sortBy Sort order (1-6)
 * @param limit Number of markets to fetch
 */
export async function fetchActiveMarkets(
  sortBy: MarketSortBy = 5,
  limit: number = 20
): Promise<OpinionMarket[]> {
  const result = await fetchOpinionAPI<OpinionMarketListResult>(
    `/market?status=activated&limit=${Math.min(limit, 100)}&sortBy=${sortBy}`
  );
  return result.list || [];
}

/**
 * Fetch top markets by 24h volume
 */
export async function fetchTopVolumeMarkets(limit: number = 10): Promise<OpinionMarket[]> {
  return fetchActiveMarkets(5, limit);
}

/**
 * Fetch newest activated markets
 */
export async function fetchNewestMarkets(limit: number = 10): Promise<OpinionMarket[]> {
  return fetchActiveMarkets(2, limit);
}

/**
 * Fetch markets closing soon (sorted by cutoff date ascending)
 */
export async function fetchClosingSoonMarkets(limit: number = 10): Promise<OpinionMarket[]> {
  return fetchActiveMarkets(6, limit);
}

/**
 * Calculate platform-wide statistics
 */
export async function fetchPlatformStats(): Promise<{
  totalMarkets: number;
  total24hVolume: number;
  avgMarketVolume: number;
}> {
  // Fetch a large batch of markets to calculate stats
  const result = await fetchOpinionAPI<OpinionMarketListResult>(
    `/market?status=activated&limit=100&sortBy=5`
  );

  const markets = result.list || [];
  const totalMarkets = result.total || markets.length;

  let total24hVolume = 0;
  for (const market of markets) {
    total24hVolume += parseFloat(market.volume24h || '0');
  }

  // Extrapolate if we have a sample
  const avgMarketVolume = markets.length > 0 ? total24hVolume / markets.length : 0;
  const extrapolatedTotal = avgMarketVolume * totalMarkets;

  return {
    totalMarkets,
    total24hVolume: extrapolatedTotal,
    avgMarketVolume,
  };
}

