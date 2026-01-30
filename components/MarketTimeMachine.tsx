import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause,
    Target,
    Activity,
    TrendingUp,
    ShieldAlert,
    ArrowUpDown,
    Bookmark,
    SkipForward,
    X,
    Check,
    Trophy
} from 'lucide-react';
import { Orderbook } from './Orderbook';
import {
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Bar,
    ComposedChart,
    BarChart,
    ReferenceLine,
    Label
} from 'recharts';
import { Market, MarketDataPoint, HeuristicSignal, TechnicalMetrics, MarketStatistics, PaperTradingState, VirtualTrade, TradeAnnotation, KeyMoment } from '../types';
import { fetchTokenPriceHistory, OpinionPricePoint, isAPIKeyConfigured } from '../services/opinionApiClient';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | 'max';

const INTERVAL_CONFIG: Record<TimeRange, { interval: '1m' | '1h' | '1d'; label: string }> = {
    '1h': { interval: '1m', label: 'Last Hour' },
    '6h': { interval: '1m', label: 'Last 6 Hours' },
    '24h': { interval: '1h', label: 'Last 24 Hours' },
    '7d': { interval: '1h', label: 'Last 7 Days' },
    '30d': { interval: '1d', label: 'Last 30 Days' },
    '90d': { interval: '1d', label: 'Last 90 Days' },
    'max': { interval: '1d', label: 'All Time' }
};

interface MarketTimeMachineProps {
    market: Market;
}

export const MarketTimeMachine: React.FC<MarketTimeMachineProps> = ({ market }) => {
    // --- REPLAY & DATA STATE ---
    const [processedData, setProcessedData] = useState<MarketDataPoint[]>([]);
    const [stats, setStats] = useState<MarketStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // --- PAPER TRADING STATE ---
    const INITIAL_BALANCE = 1000;
    const [paperTrading, setPaperTrading] = useState<PaperTradingState>({
        balance: INITIAL_BALANCE,
        initialBalance: INITIAL_BALANCE,
        position: null,
        trades: [],
        totalPnL: 0,
        winCount: 0,
        lossCount: 0
    });
    const [showSummary, setShowSummary] = useState(false);

    // --- ANNOTATIONS & KEY MOMENTS ---
    const [annotations, setAnnotations] = useState<TradeAnnotation[]>([]);
    const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
    const [showAnnotationModal, setShowAnnotationModal] = useState(false);
    const [annotationNote, setAnnotationNote] = useState('');

    // --- UTILITIES ---
    const calculateZScore = (price: number, mean: number, stdDev: number) => {
        if (stdDev === 0) return 0;
        return (price - mean) / stdDev;
    };

    // --- DATA ACQUISITION & PRE-COMPUTATION ---
    useEffect(() => {
        const loadDetailedData = async () => {
            setIsLoading(true);
            try {
                // 1. Calculate Time Range & Interval
                const config = INTERVAL_CONFIG[timeRange];
                const now = Math.floor(Date.now() / 1000);
                const marketStart = Math.floor(market.resolutionTimestamp / 1000) - (86400 * 30); // Approximate start if unknown

                const rangeSeconds: Record<TimeRange, number> = {
                    '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000, '90d': 7776000, 'max': now - marketStart
                };

                const startTime = now - rangeSeconds[timeRange];

                // 2. Fetch YES and NO Token History (Multi-Stream)
                let yesHistory: OpinionPricePoint[] = [];
                let noHistory: OpinionPricePoint[] = [];

                if (market.yesTokenId) {
                    yesHistory = await fetchTokenPriceHistory(market.yesTokenId, config.interval, startTime);
                }

                if (market.noTokenId) {
                    noHistory = await fetchTokenPriceHistory(market.noTokenId, config.interval, startTime);
                } else {
                    // Fallback to complement if NO token is missing
                    noHistory = yesHistory.map(p => ({ ...p, p: (1 - parseFloat(p.p)).toString() }));
                }

                // 3. Merge & Normalize Dual Streams
                const dataMap = new Map();
                yesHistory.forEach(p => dataMap.set(p.t, { t: p.t, yes: parseFloat(p.p), no: null }));
                noHistory.forEach(p => {
                    const existing = dataMap.get(p.t);
                    if (existing) existing.no = parseFloat(p.p);
                    else dataMap.set(p.t, { t: p.t, yes: null, no: parseFloat(p.p) });
                });

                const mergedPoints = Array.from(dataMap.values())
                    .sort((a, b) => a.t - b.t)
                    .map(p => ({
                        timestamp: p.t * 1000,
                        yesPrice: p.yes ?? (p.no != null ? 1 - p.no : 0.5),
                        noPrice: p.no ?? (p.yes != null ? 1 - p.yes : 0.5),
                        displayTime: new Date(p.t * 1000).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            ...(timeRange !== '1h' && timeRange !== '6h' ? { month: 'short', day: 'numeric' } : {})
                        })
                    }));

                // 4. Volatility-Weighted Volume Distribution
                const totalVol = market.volume7d || market.totalVolume || 1000000;
                const priceDeltas = mergedPoints.map((p, i) => i === 0 ? 0 : Math.abs(p.yesPrice - mergedPoints[i - 1].yesPrice));
                const totalDelta = priceDeltas.reduce((a, b) => a + b, 0);

                const preData = mergedPoints.map((p, index) => ({
                    ...p,
                    volume: totalDelta > 0 ? (priceDeltas[index] / totalDelta) * totalVol : totalVol / mergedPoints.length,
                }));

                // 5. Pre-compute Heuristics & Metrics
                const finalData: MarketDataPoint[] = preData.map((point, index) => {
                    // Rolling Window (20-tick)
                    const windowSize = 20;
                    const start = Math.max(0, index - windowSize + 1);
                    const window = preData.slice(start, index + 1);
                    const prices = window.map(w => w.yesPrice);

                    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
                    const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length) || 0.01;
                    const zScore = calculateZScore(point.yesPrice, mean, stdDev);

                    const momentum = window.length > 1 ? ((point.yesPrice - prices[0]) / prices[0]) * 100 : 0;
                    const volatility: 'High' | 'Medium' | 'Low' = stdDev > 0.08 ? 'High' : stdDev > 0.03 ? 'Medium' : 'Low';

                    const avgVol = window.reduce((sum, w) => sum + w.volume, 0) / window.length;

                    const metrics: TechnicalMetrics = {
                        trend: momentum > 3 ? 'Bullish' : momentum < -3 ? 'Bearish' : 'Ranging',
                        momentum,
                        volatility,
                        volatilityScore: stdDev,
                        volumeStatus: point.volume > avgVol * 1.5 ? 'Above Average' : point.volume < avgVol * 0.5 ? 'Below Average' : 'Normal',
                        zScore
                    };

                    const signals: HeuristicSignal[] = [];
                    const accuracy = (market.qualityScore || 80) + (index % 10);

                    if (zScore < -2.0) signals.push({ type: 'BUY', badge: '📉 OVERSOLD', reason: `Mean reversion probable at ${Math.abs(zScore).toFixed(1)}σ deviation.`, confidence: 'High', icon: '📉', color: 'green', accuracy: accuracy - 2 });
                    if (zScore > 2.0) signals.push({ type: 'SELL', badge: '📈 OVERBOUGHT', reason: `Distribution risk elevated at ${zScore.toFixed(1)}σ deviation.`, confidence: 'Medium', icon: '📈', color: 'red', accuracy: accuracy - 5 });
                    if (point.volume > avgVol * 4) signals.push({ type: 'BUY', badge: '🔥 LIQUIDITY SPIKE', reason: 'High-conviction institutional activity detected.', confidence: 'High', icon: '🔥', color: 'green' });

                    let overall: HeuristicSignal = { type: 'HOLD', badge: 'MONITOR', reason: 'Analyzing market structural flow...', confidence: 'N/A', icon: '⚫', color: 'gray' };
                    if (zScore < -1.7 && metrics.trend !== 'Bearish') {
                        overall = { type: 'BUY', badge: 'STRONG BUY', reason: 'Statistical deviation aligned with primary trend.', confidence: 'High', icon: '🟢', color: 'green' };
                    } else if (zScore > 1.7 || point.yesPrice > 0.95) {
                        overall = { type: 'SELL', badge: 'DISTRIBUTION', reason: 'Price exhausting or mean reversion imminent.', confidence: 'Medium', icon: '🔴', color: 'red' };
                    }

                    return { ...point, metrics, signals, overallSignal: overall };
                });

                setProcessedData(finalData);

                // Global Stats
                const allPrices = finalData.map(d => d.yesPrice);
                setStats({
                    minPrice: Math.min(...allPrices),
                    maxPrice: Math.max(...allPrices),
                    avgPrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
                    startPrice: allPrices[0],
                    endPrice: allPrices[allPrices.length - 1],
                    priceChange: allPrices[allPrices.length - 1] - allPrices[0],
                    priceChangePercent: ((allPrices[allPrices.length - 1] - allPrices[0]) / (allPrices[0] || 0.1)) * 100,
                    volatility: Math.sqrt(allPrices.reduce((s, p) => s + Math.pow(p - (allPrices.reduce((a, b) => a + b, 0) / allPrices.length), 2), 0) / allPrices.length)
                });

                setCurrentIndex(0);

                // Detect key moments
                const moments: KeyMoment[] = [];
                for (let i = 1; i < finalData.length; i++) {
                    const prev = finalData[i - 1];
                    const curr = finalData[i];
                    const priceChange = Math.abs(curr.yesPrice - prev.yesPrice);

                    // Price spike detection (>5% move)
                    if (priceChange > 0.05) {
                        moments.push({
                            index: i,
                            timestamp: curr.timestamp,
                            type: 'price_spike',
                            label: `${priceChange > 0 ? '📈' : '📉'} ${(priceChange * 100).toFixed(1)}% Move`,
                            severity: priceChange > 0.1 ? 'high' : 'medium'
                        });
                    }

                    // Volume surge detection
                    if (curr.volume > prev.volume * 3 && curr.volume > 10000) {
                        moments.push({
                            index: i,
                            timestamp: curr.timestamp,
                            type: 'volume_surge',
                            label: '🔥 Volume Surge',
                            severity: 'high'
                        });
                    }

                    // Signal confluence
                    if (curr.signals.length >= 2) {
                        moments.push({
                            index: i,
                            timestamp: curr.timestamp,
                            type: 'signal_confluence',
                            label: '⚡ Signal Confluence',
                            severity: 'medium'
                        });
                    }
                }
                setKeyMoments(moments);

                // Reset paper trading on data reload
                setPaperTrading({
                    balance: INITIAL_BALANCE,
                    initialBalance: INITIAL_BALANCE,
                    position: null,
                    trades: [],
                    totalPnL: 0,
                    winCount: 0,
                    lossCount: 0
                });
                setAnnotations([]);
            } catch (err) {
                console.error("Failed to process multi-timeframe market data", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadDetailedData();
    }, [market.id, market.yesTokenId, market.noTokenId, market.volume7d, market.totalVolume, market.qualityScore, timeRange]);

    // --- DATA DERIVATION FOR REPLAY ---
    const currentFrame = useMemo(() => processedData[currentIndex] || processedData[0], [processedData, currentIndex]);

    // Chart visible window (last 50 points)
    const chartData = useMemo(() => {
        const start = Math.max(0, currentIndex - 50);
        return processedData.slice(start, currentIndex + 1);
    }, [processedData, currentIndex]);

    // Proportional Session Zoom: Always start at 0 for low-percentage markets to maximize the "bump" effect
    const sessionPriceBounds = useMemo(() => {
        if (!processedData || processedData.length === 0) return { min: 0, max: 0.1, ticks: [0, 0.025, 0.05, 0.075, 0.1] };

        const validValues = processedData
            .filter(d => d.yesPrice > 0.005 && d.yesPrice < 0.995)
            .map(d => d.yesPrice);

        const allPrices = validValues.length > 5 ? validValues : processedData.map(d => d.yesPrice);
        const globalMax = Math.max(...allPrices);

        // Standard high-fidelity ceilings (0-10%, 0-20%, 0-50%, 0-100%)
        let finalMax: number;
        if (globalMax <= 0.09) finalMax = 0.10;
        else if (globalMax <= 0.18) finalMax = 0.20;
        else if (globalMax <= 0.45) finalMax = 0.50;
        else finalMax = 1.0;

        const floor = 0; // Always start at 0 for the requested "bump" perspective

        // Generate EXACTLY 5 Ticks
        const ticks = [];
        const tickStep = finalMax / 4;
        for (let i = 0; i <= 4; i++) {
            ticks.push(tickStep * i);
        }

        return { min: floor, max: finalMax, ticks };
    }, [processedData]);

    const signals = currentFrame?.signals || [];
    const metrics = currentFrame?.metrics || { trend: 'Ranging', momentum: 0, volatility: 'Low', volatilityScore: 0, volumeStatus: 'Normal', zScore: 0 };
    const overallSignal = currentFrame?.overallSignal || { type: 'HOLD', badge: 'WAITING', reason: 'No clear signal detected', confidence: 'N/A', icon: '⚫', color: 'gray' };

    // --- PLAYBACK CONTROL ---
    useEffect(() => {
        if (isPlaying && !isLoading) {
            timerRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= processedData.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000 / playbackSpeed);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isPlaying, playbackSpeed, processedData.length, isLoading]);

    // --- PAPER TRADING FUNCTIONS ---
    const getCurrentUnrealizedPnL = useCallback(() => {
        if (!paperTrading.position || !currentFrame) return 0;
        const currentPrice = paperTrading.position.type === 'YES' ? currentFrame.yesPrice : currentFrame.noPrice;
        return (currentPrice - paperTrading.position.entryPrice) * paperTrading.position.shares;
    }, [paperTrading.position, currentFrame]);

    const handleBuy = useCallback((type: 'YES' | 'NO') => {
        if (paperTrading.position || !currentFrame) return;
        const price = type === 'YES' ? currentFrame.yesPrice : currentFrame.noPrice;
        const shares = Math.floor(paperTrading.balance / price);
        if (shares <= 0) return;

        const cost = shares * price;
        setPaperTrading(prev => ({
            ...prev,
            balance: prev.balance - cost,
            position: {
                type,
                shares,
                entryPrice: price,
                entryTimestamp: currentFrame.timestamp
            }
        }));

        // Auto-add annotation for trade
        setAnnotations(prev => [...prev, {
            id: `trade-${Date.now()}`,
            timestamp: currentFrame.timestamp,
            dataIndex: currentIndex,
            note: `Bought ${shares} ${type} @ ${(price * 100).toFixed(1)}¢`,
            type: 'trade',
            color: type === 'YES' ? '#00FF9C' : '#FF3E5E'
        }]);
    }, [paperTrading.position, paperTrading.balance, currentFrame, currentIndex]);

    const handleClosePosition = useCallback(() => {
        if (!paperTrading.position || !currentFrame) return;
        const exitPrice = paperTrading.position.type === 'YES' ? currentFrame.yesPrice : currentFrame.noPrice;
        const pnl = (exitPrice - paperTrading.position.entryPrice) * paperTrading.position.shares;
        const pnlPercent = ((exitPrice - paperTrading.position.entryPrice) / paperTrading.position.entryPrice) * 100;

        const trade: VirtualTrade = {
            id: `trade-${Date.now()}`,
            type: paperTrading.position.type === 'YES' ? 'BUY_YES' : 'BUY_NO',
            entryPrice: paperTrading.position.entryPrice,
            exitPrice,
            shares: paperTrading.position.shares,
            timestamp: paperTrading.position.entryTimestamp,
            exitTimestamp: currentFrame.timestamp,
            pnl,
            pnlPercent
        };

        setPaperTrading(prev => ({
            ...prev,
            balance: prev.balance + (exitPrice * prev.position!.shares),
            position: null,
            trades: [...prev.trades, trade],
            totalPnL: prev.totalPnL + pnl,
            winCount: pnl > 0 ? prev.winCount + 1 : prev.winCount,
            lossCount: pnl < 0 ? prev.lossCount + 1 : prev.lossCount
        }));

        // Auto-add close annotation
        setAnnotations(prev => [...prev, {
            id: `close-${Date.now()}`,
            timestamp: currentFrame.timestamp,
            dataIndex: currentIndex,
            note: `Closed @ ${(exitPrice * 100).toFixed(1)}¢ | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
            type: 'trade',
            color: pnl >= 0 ? '#00FF9C' : '#FF3E5E'
        }]);
    }, [paperTrading.position, currentFrame, currentIndex]);

    const jumpToNextMoment = useCallback(() => {
        const next = keyMoments.find(m => m.index > currentIndex);
        if (next) setCurrentIndex(next.index);
    }, [keyMoments, currentIndex]);

    const addAnnotation = useCallback(() => {
        if (!currentFrame || !annotationNote.trim()) return;
        setAnnotations(prev => [...prev, {
            id: `note-${Date.now()}`,
            timestamp: currentFrame.timestamp,
            dataIndex: currentIndex,
            note: annotationNote,
            type: 'custom',
            color: '#FF6100'
        }]);
        setAnnotationNote('');
        setShowAnnotationModal(false);
    }, [currentFrame, currentIndex, annotationNote]);

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsPlaying(prev => !prev);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    setCurrentIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    setCurrentIndex(prev => Math.min(processedData.length - 1, prev + 1));
                    break;
                case 'Digit1': setPlaybackSpeed(0.5); break;
                case 'Digit2': setPlaybackSpeed(1); break;
                case 'Digit3': setPlaybackSpeed(2); break;
                case 'Digit4': setPlaybackSpeed(8); break;
                case 'Digit5': setPlaybackSpeed(15); break;
                case 'KeyM':
                    e.preventDefault();
                    setShowAnnotationModal(true);
                    break;
                case 'KeyN':
                    e.preventDefault();
                    jumpToNextMoment();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [processedData.length, jumpToNextMoment]);

    // --- SHOW SUMMARY AT END OF REPLAY ---
    useEffect(() => {
        if (currentIndex === processedData.length - 1 && processedData.length > 0 && !isPlaying && paperTrading.trades.length > 0) {
            setShowSummary(true);
        }
    }, [currentIndex, processedData.length, isPlaying, paperTrading.trades.length]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#FF6100]/20 border-t-[#FF6100] rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Initializing Engine...</span>
                </div>
            </div>
        );
    }

    if (!currentFrame || processedData.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="cyber-card p-10 bg-[#FF3E5E]/5 border-[#FF3E5E]/20 flex flex-col items-center gap-6 max-w-md text-center">
                    <div className="p-4 rounded-full bg-[#FF3E5E]/10">
                        <ShieldAlert size={40} className="text-[#FF3E5E]" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Engine Initialization Failed</h3>
                        <p className="text-[10px] text-zinc-500 font-bold leading-relaxed uppercase">
                            The temporal datastreams for this market are currently unavailable.
                            This often happens when rate limits are exceeded or the market is too new.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 rounded-lg bg-[#FF6100] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl"
                    >
                        Re-Synchronize Engine
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden space-y-6">
            {/* 1. TOP CONTROLS DASHBOARD */}
            <div className="grid grid-cols-12 gap-6 items-center bg-[#0C0C0E]/60 p-6 rounded-2xl border border-white/5 shadow-2xl">
                {/* Status & Anchor */}
                <div className="col-span-3 flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Temporal Anchor</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-black text-white leading-none">
                            {new Date(currentFrame.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-sm font-mono font-bold text-[#FF6100]">
                            {new Date(currentFrame.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>

                {/* Playback Engine */}
                <div className="col-span-4 flex items-center gap-6 border-x border-white/5 px-6">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-4 rounded-2xl transition-all shadow-2xl ${isPlaying ? 'bg-zinc-800 text-white' : 'bg-[#00FF9C] text-black hover:scale-110 active:scale-95'}`}
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>

                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-none mb-3">Engine Speed</span>
                        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                            {[0.5, 1, 2, 8, 15].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setPlaybackSpeed(s)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-black transition-all ${playbackSpeed === s ? 'bg-[#FF6100] text-black shadow-lg scale-105' : 'text-zinc-600 hover:text-white'}`}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Time Window (The new feature) */}
                <div className="col-span-3 flex flex-col px-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Horizon Window</span>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
                        {(Object.keys(INTERVAL_CONFIG) as TimeRange[]).map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${timeRange === r ? 'bg-[#FF6100] text-black shadow-lg scale-105' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Engine Health */}
                <div className="col-span-2 flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Engine Sync</span>
                    <div className="flex items-center gap-2 bg-[#00FF9C]/5 px-3 py-2 rounded-lg border border-[#00FF9C]/10">
                        <Activity size={12} className="text-[#00FF9C] animate-pulse" />
                        <span className="text-xs font-mono font-black text-white">{(12 / playbackSpeed).toFixed(1)}ms Sync</span>
                    </div>
                </div>
            </div>

            {/* 1.5 PAPER TRADING PANEL */}
            <div className="grid grid-cols-12 gap-4 bg-[#0C0C0E]/60 p-4 rounded-2xl border border-white/5 shadow-xl">
                {/* Balance & P&L */}
                <div className="col-span-3 flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">Balance</span>
                        <span className="text-lg font-mono font-black text-white">${paperTrading.balance.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">Total P&L</span>
                        <span className={`text-lg font-mono font-black ${paperTrading.totalPnL >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                            {paperTrading.totalPnL >= 0 ? '+' : ''}${paperTrading.totalPnL.toFixed(2)}
                        </span>
                    </div>
                    {paperTrading.position && (
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">Unrealized</span>
                            <span className={`text-lg font-mono font-black ${getCurrentUnrealizedPnL() >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                                {getCurrentUnrealizedPnL() >= 0 ? '+' : ''}${getCurrentUnrealizedPnL().toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Position Info */}
                <div className="col-span-3 flex items-center justify-center">
                    {paperTrading.position ? (
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                            <div className={`w-3 h-3 rounded-full ${paperTrading.position.type === 'YES' ? 'bg-[#00FF9C]' : 'bg-[#FF3E5E]'}`} />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-white uppercase">{paperTrading.position.shares} {paperTrading.position.type}</span>
                                <span className="text-[8px] text-zinc-500 font-mono">@ {(paperTrading.position.entryPrice * 100).toFixed(1)}¢</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">No Position</span>
                    )}
                </div>

                {/* Trade Buttons */}
                <div className="col-span-4 flex items-center justify-center gap-3">
                    {!paperTrading.position ? (
                        <>
                            <button
                                onClick={() => handleBuy('YES')}
                                disabled={paperTrading.balance < (currentFrame?.yesPrice || 1)}
                                className="px-6 py-2.5 rounded-xl bg-[#00FF9C] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100"
                            >
                                Buy YES
                            </button>
                            <button
                                onClick={() => handleBuy('NO')}
                                disabled={paperTrading.balance < (currentFrame?.noPrice || 1)}
                                className="px-6 py-2.5 rounded-xl bg-[#FF3E5E] text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100"
                            >
                                Buy NO
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleClosePosition}
                            className="px-8 py-2.5 rounded-xl bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-600 hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            Close Position
                        </button>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                        onClick={jumpToNextMoment}
                        disabled={!keyMoments.find(m => m.index > currentIndex)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                        title="Next Key Moment (N)"
                    >
                        <SkipForward size={16} />
                    </button>
                    <button
                        onClick={() => setShowAnnotationModal(true)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-[#FF6100] hover:bg-white/10 transition-all"
                        title="Add Annotation (M)"
                    >
                        <Bookmark size={16} />
                    </button>
                    {paperTrading.trades.length > 0 && (
                        <button
                            onClick={() => setShowSummary(true)}
                            className="p-2 rounded-lg bg-[#FF6100]/10 border border-[#FF6100]/20 text-[#FF6100] hover:bg-[#FF6100]/20 transition-all"
                            title="View Summary"
                        >
                            <Trophy size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-8 items-start min-h-0">
                {/* 2. MAIN CHART AREA (8 cols) */}
                <div className="col-span-8 flex flex-col h-full space-y-6">
                    <div className="cyber-card flex-1 bg-black/40 border-white/5 relative group p-6 shadow-2xl min-h-0 flex flex-col">
                        <div className="absolute top-6 left-6 z-20 pointer-events-none">
                            <AnimatePresence>
                                <motion.div
                                    key={overallSignal.badge}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className={`px-4 py-2 rounded-lg border-2 font-black text-[11px] tracking-widest shadow-2xl flex items-center gap-3 ${overallSignal.type === 'BUY' ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C]' :
                                        overallSignal.type === 'SELL' ? 'bg-[#FF3E5E]/10 border-[#FF3E5E] text-[#FF3E5E]' :
                                            'bg-zinc-800/50 border-white/10 text-zinc-400'
                                        }`}>
                                        <span className="text-base">{overallSignal.icon}</span>
                                        {overallSignal.badge}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className="flex-1 min-h-0 relative">
                            {/* Watermark */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0 select-none">
                                <span className="text-8xl font-black italic tracking-tighter text-white">OPINION</span>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 40, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF6100" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#FF6100" stopOpacity={0} />
                                        </linearGradient>
                                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="4" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                    </defs>
                                    <CartesianGrid strokeDasharray="0" stroke="#ffffff03" vertical={false} />
                                    <XAxis
                                        dataKey="displayTime"
                                        stroke="#ffffff20"
                                        fontSize={10}
                                        fontFamily="monospace"
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#ffffff20"
                                        fontSize={10}
                                        fontFamily="monospace"
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[sessionPriceBounds.min, sessionPriceBounds.max]}
                                        ticks={sessionPriceBounds.ticks}
                                        tickFormatter={(v) => `${(v * 100).toFixed(1)}¢`}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[#121214] border border-white/10 p-3 rounded-xl shadow-2xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-[#FF6100]" />
                                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">YES</span>
                                                            <span className="text-[11px] font-mono font-bold text-white ml-auto">{(data.yesPrice * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-zinc-500">
                                                            <span className="text-[9px] font-mono">{new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}, {new Date(data.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area
                                        type="stepAfter"
                                        dataKey="yesPrice"
                                        stroke="#FF6100"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorYes)"
                                        filter="url(#glow)"
                                        isAnimationActive={false}
                                        dot={(props: any) => {
                                            const { cx, cy, index } = props;
                                            if (index === chartData.length - 1) {
                                                return (
                                                    <g key={`dot-${index}`}>
                                                        <circle cx={cx} cy={cy} r={4} fill="#FF6100" />
                                                        <circle cx={cx} cy={cy} r={8} fill="#FF6100" opacity={0.3}>
                                                            <animate attributeName="r" from="4" to="12" dur="1.5s" repeatCount="indefinite" />
                                                            <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
                                                        </circle>
                                                    </g>
                                                );
                                            }
                                            return null as any;
                                        }}
                                    />
                                    <ReferenceLine
                                        y={currentFrame.yesPrice}
                                        stroke="#FF6100"
                                        strokeDasharray="4 4"
                                        opacity={0.15}
                                    >
                                        <Label
                                            value={`${(currentFrame.yesPrice * 100).toFixed(1)}¢`}
                                            position="right"
                                            fill="#FF6100"
                                            fontSize={10}
                                            fontFamily="monospace"
                                            fontWeight="bold"
                                        />
                                    </ReferenceLine>
                                    <Area
                                        type="stepAfter"
                                        dataKey="noPrice"
                                        stroke="#ffffff"
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                        fill="transparent"
                                        isAnimationActive={false}
                                        opacity={0.05}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Volume Sub-Chart */}
                        <div className="h-24 mt-4 border-t border-white/5 pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <Bar
                                        dataKey="volume"
                                        fill="#FF6100"
                                        opacity={0.3}
                                        isAnimationActive={false}
                                        radius={[2, 2, 0, 0]}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'white', opacity: 0.05 }}
                                        contentStyle={{ display: 'none' }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 3. TIMELINE SCRUBBER */}
                    <div className="cyber-card bg-[#0C0C0E]/60 p-6 border-white/5 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Historical Timeline</span>
                                <div className="px-2 py-0.5 rounded bg-[#FF6100]/20 text-[#FF6100] text-[8px] font-mono font-black animate-pulse">
                                    LIVE REPLAY
                                </div>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-600">
                                {currentIndex + 1} / {processedData.length} TICKS
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={processedData.length - 1}
                            value={currentIndex}
                            onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                            className="cyber-range w-full"
                        />
                    </div>
                </div>

                {/* 4. SIDEBAR - LIVE STATS & HEURISTICS (4 cols) */}
                <div className="col-span-4 flex flex-col space-y-6 overflow-y-auto custom-scrollbar h-full pr-2 pb-10">
                    {/* OVERALL SIGNAL PANEL */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">
                            <Target size={14} className="text-[#FF6100]" />
                            Decision Matrix
                        </div>
                        <div className={`cyber-card p-6 border-l-4 shadow-2xl space-y-4 ${overallSignal.type === 'BUY' ? 'border-l-[#00FF9C] bg-[#00FF9C]/5' :
                            overallSignal.type === 'SELL' ? 'border-l-[#FF3E5E] bg-[#FF3E5E]/5' :
                                'border-l-zinc-700 bg-white/[0.02]'
                            }`}>
                            <div className="flex justify-between items-center">
                                <span className="text-2xl">{overallSignal.icon}</span>
                                <div className="text-right">
                                    <div className="text-xs font-black text-white uppercase tracking-widest">{overallSignal.badge}</div>
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Confidence: {overallSignal.confidence}</div>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed italic border-t border-white/5 pt-3">
                                "{overallSignal.reason}"
                            </p>
                        </div>
                    </section>

                    {/* ALPHA ANALYSIS */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">
                            <TrendingUp size={14} className="text-[#FF6100]" />
                            Alpha Indicators
                        </div>
                        <div className="cyber-card p-5 bg-black/40 border-white/5 space-y-4 shadow-xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] text-zinc-600 font-black uppercase block mb-1">Z-Score (20t)</span>
                                    <span className={`text-xs font-mono font-black ${Math.abs(metrics.zScore) > 2 ? 'text-[#FF3E5E]' : 'text-[#00FF9C]'}`}>
                                        {metrics.zScore > 0 ? '+' : ''}{metrics.zScore.toFixed(2)}σ
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] text-zinc-600 font-black uppercase block mb-1">Rel Volatility</span>
                                    <span className={`text-xs font-mono font-black ${metrics.volatility === 'High' ? 'text-[#FF3E5E]' : 'text-white'}`}>
                                        {metrics.volatility} ({(metrics.volatilityScore * 100).toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] text-zinc-600 font-black uppercase block mb-1">Max High</span>
                                    <span className="text-xs font-mono font-black text-[#00FF9C]">
                                        ${(stats?.maxPrice || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] text-zinc-600 font-black uppercase block mb-1">Min Low</span>
                                    <span className="text-xs font-mono font-black text-[#FF3E5E]">
                                        ${(stats?.minPrice || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* L2 ORDERBOOK */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">
                            <ArrowUpDown size={14} className="text-[#FF6100]" />
                            Liquidity Depth
                        </div>
                        <Orderbook
                            yesTokenId={market.yesTokenId}
                            noTokenId={market.noTokenId}
                            currentPrice={currentFrame.yesPrice}
                        />
                    </section>

                    {/* HEURISTIC FEED */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">
                            <Activity size={14} className="text-[#FF6100]" />
                            Heuristic Streams
                        </div>
                        <div className="space-y-3">
                            {signals.map((s, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={s.badge + i}
                                    className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5"
                                >
                                    <span className="text-lg mt-0.5">{s.icon}</span>
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{s.badge}</span>
                                                <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                                <span className="text-[8px] font-bold text-zinc-600 uppercase">{s.confidence}</span>
                                            </div>
                                            {s.accuracy && (
                                                <span className="text-[8px] font-mono text-zinc-500">ACC: {s.accuracy}%</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 leading-snug">{s.reason}</p>
                                    </div>
                                </motion.div>
                            ))}
                            {signals.length === 0 && (
                                <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center">
                                    <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest leading-relaxed">
                                        Scanning datastreams for signal confluence...
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* RISK ADVISORY */}
                    <div className="flex flex-col gap-3">
                        <div className={`p-4 rounded-xl border ${isAPIKeyConfigured() ? 'bg-[#00FF9C]/5 border-[#00FF9C]/20' : 'bg-[#FF3E5E]/5 border-[#FF3E5E]/20'}`}>
                            <div className="flex gap-3">
                                <ShieldAlert size={16} className={`${isAPIKeyConfigured() ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'} shrink-0`} />
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight leading-relaxed">
                                    {isAPIKeyConfigured()
                                        ? "Live Replay: Historical datastreams synchronized from Opinion API. Analysis mode active."
                                        : "Sandbox: Simulated datastreams active. Execute with heuristic caution."}
                                </p>
                            </div>
                        </div>
                        <div className="px-4">
                            <p className="text-[7px] text-zinc-700 font-medium uppercase leading-relaxed text-center">
                                All signals are derived from rolling statistical models (Z-Score, Standard Deviation) and do not constitute financial advice. Accuracy is simulated based on historical market quality metrics.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SUMMARY MODAL */}
            <AnimatePresence>
                {showSummary && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                        onClick={() => setShowSummary(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#0C0C0E] rounded-3xl border border-white/10 p-8 max-w-lg w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Trophy size={24} className="text-[#FF6100]" />
                                    <h2 className="text-lg font-black text-white uppercase tracking-widest">Trading Summary</h2>
                                </div>
                                <button onClick={() => setShowSummary(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                                    <X size={20} className="text-zinc-400" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase block mb-1">Final Balance</span>
                                    <span className="text-2xl font-mono font-black text-white">${paperTrading.balance.toFixed(2)}</span>
                                </div>
                                <div className={`p-4 rounded-xl border ${paperTrading.totalPnL >= 0 ? 'bg-[#00FF9C]/10 border-[#00FF9C]/20' : 'bg-[#FF3E5E]/10 border-[#FF3E5E]/20'}`}>
                                    <span className="text-[9px] text-zinc-500 font-black uppercase block mb-1">Total P&L</span>
                                    <span className={`text-2xl font-mono font-black ${paperTrading.totalPnL >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                                        {paperTrading.totalPnL >= 0 ? '+' : ''}${paperTrading.totalPnL.toFixed(2)}
                                    </span>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase block mb-1">Total Trades</span>
                                    <span className="text-2xl font-mono font-black text-white">{paperTrading.trades.length}</span>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase block mb-1">Win Rate</span>
                                    <span className="text-2xl font-mono font-black text-white">
                                        {paperTrading.trades.length > 0 ? ((paperTrading.winCount / paperTrading.trades.length) * 100).toFixed(0) : 0}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Check size={16} className="text-[#00FF9C]" />
                                    <span className="text-sm font-bold text-white">{paperTrading.winCount} Wins</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <X size={16} className="text-[#FF3E5E]" />
                                    <span className="text-sm font-bold text-white">{paperTrading.lossCount} Losses</span>
                                </div>
                            </div>

                            {paperTrading.trades.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Trade History</span>
                                    {paperTrading.trades.map((trade, i) => (
                                        <div key={trade.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                                            <span className="font-mono text-zinc-400">#{i + 1} {trade.type.replace('BUY_', '')}</span>
                                            <span className={`font-mono font-bold ${(trade.pnl || 0) >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                                                {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ANNOTATION MODAL */}
            <AnimatePresence>
                {showAnnotationModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                        onClick={() => setShowAnnotationModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#0C0C0E] rounded-3xl border border-white/10 p-8 max-w-md w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Bookmark size={24} className="text-[#FF6100]" />
                                    <h2 className="text-lg font-black text-white uppercase tracking-widest">Add Note</h2>
                                </div>
                                <button onClick={() => setShowAnnotationModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                                    <X size={20} className="text-zinc-400" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">
                                    {new Date(currentFrame.timestamp).toLocaleString()}
                                </span>
                                <span className="text-sm font-mono text-white">
                                    Price: {(currentFrame.yesPrice * 100).toFixed(1)}¢
                                </span>
                            </div>

                            <textarea
                                value={annotationNote}
                                onChange={(e) => setAnnotationNote(e.target.value)}
                                placeholder="What's notable about this moment..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm font-medium placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6100]/50 resize-none h-24"
                                autoFocus
                            />

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowAnnotationModal(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addAnnotation}
                                    disabled={!annotationNote.trim()}
                                    className="flex-1 py-3 rounded-xl bg-[#FF6100] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-30"
                                >
                                    Save Note
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
