
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Market {
  id: string;
  name: string;
  description: string;
  outcome: 'YES' | 'NO';
  candles: Candle[];
  resolutionTimestamp: number;
  cutoffAt: number; // Expiry timestamp in ms
  qualityScore: number; // 0-100
  yesTokenId?: string; // Added for Opinion API integration
  noTokenId?: string; // Added for dual-token fetching
  totalVolume?: number;
  volume24h?: number;
  volume7d?: number;
  topicId?: string; // Topic ID for image lookup
  imageUrl?: string; // Market thumbnail image
}

export type StrategyType = 'EARLY_ENTRY' | 'VOLUME_FADE' | 'MARKET_MAKING' | 'STOP_LOSS_NEAR_RES';

export interface StrategyConfig {
  type: StrategyType;
  params: Record<string, number>;
  slippage: number; // 0 to 0.1 (0% to 10%)
}

export interface Trade {
  type: 'BUY' | 'SELL';
  price: number;
  amount: number;
  timestamp: number;
  pnl?: number;
  label?: string;
  reason?: string;
}

export interface BaselineCurve {
  name: string;
  data: { timestamp: number; equity: number }[];
  color: string;
}

export interface BacktestResult {
  totalPnL: number;
  returnPercentage: number;
  maxDrawdown: number;
  winRate: number;
  trades: Trade[];
  equityCurve: { timestamp: number; equity: number }[];
  baselines: BaselineCurve[];
  events: { timestamp: number; type: string; intensity: number }[];
}

export interface HeuristicSignal {
  type: 'BUY' | 'SELL' | 'HOLD' | 'INFO' | 'WARNING';
  badge: string;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low' | 'N/A';
  icon: string;
  color: string;
  accuracy?: number;
}

export interface TechnicalMetrics {
  trend: 'Bullish' | 'Bearish' | 'Ranging';
  momentum: number;
  volatility: 'High' | 'Medium' | 'Low';
  volatilityScore: number;
  volumeStatus: 'Above Average' | 'Normal' | 'Below Average';
  zScore: number;
}

export interface MarketDataPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
  displayTime: string;
  metrics: TechnicalMetrics;
  signals: HeuristicSignal[];
  overallSignal: HeuristicSignal;
}

export interface MarketStatistics {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  startPrice: number;
  endPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volatility: number;
}

export interface ReplayState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  wallet: number;
  position: number;
}

// ===== PAPER TRADING TYPES =====

export interface VirtualTrade {
  id: string;
  type: 'BUY_YES' | 'BUY_NO' | 'CLOSE';
  entryPrice: number;
  exitPrice?: number;
  shares: number;
  timestamp: number;
  exitTimestamp?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface PaperTradingState {
  balance: number;
  initialBalance: number;
  position: {
    type: 'YES' | 'NO' | null;
    shares: number;
    entryPrice: number;
    entryTimestamp: number;
  } | null;
  trades: VirtualTrade[];
  totalPnL: number;
  winCount: number;
  lossCount: number;
}

export interface TradeAnnotation {
  id: string;
  timestamp: number;
  dataIndex: number;
  note: string;
  type: 'custom' | 'trade' | 'signal';
  color: string;
}

export interface KeyMoment {
  index: number;
  timestamp: number;
  type: 'price_spike' | 'volume_surge' | 'signal_confluence' | 'trend_reversal';
  label: string;
  severity: 'high' | 'medium' | 'low';
}
