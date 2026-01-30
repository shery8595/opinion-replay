/**
 * Resolution Simulator
 * Interactive PnL calculator for position outcomes
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLiveMarketData } from '../hooks/useLiveMarket';
import { Market } from '../types';
import { SimulationResult, SimulationInput } from '../types/liveMarket';
import { DollarSign, AlertTriangle, Lock, Target, Info, TrendingUp } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

interface Props {
    market: Market;
}

/**
 * Calculate PnL outcomes for a position
 */
function calculateSimulation(input: SimulationInput, timeToResolutionDays: number): SimulationResult {
    const { positionSize, side, entryPrice } = input;

    // For YES position
    const yesExitPrice = 1.0;
    const noExitPrice = 0.0;

    let yesOutcomePnl: number, noOutcomePnl: number;

    // Prevent division by zero/near-zero
    const safeEntryPrice = Math.max(0.01, entryPrice);
    const safeNoEntryPrice = Math.max(0.01, 1 - entryPrice);

    if (side === 'YES') {
        // Bought YES tokens
        const sharesOwned = positionSize / safeEntryPrice;
        yesOutcomePnl = (yesExitPrice - safeEntryPrice) * sharesOwned;
        noOutcomePnl = (noExitPrice - safeEntryPrice) * sharesOwned;
    } else {
        // Bought NO tokens
        const sharesOwned = positionSize / safeNoEntryPrice;
        yesOutcomePnl = (noExitPrice - safeNoEntryPrice) * sharesOwned;
        noOutcomePnl = (yesExitPrice - safeNoEntryPrice) * sharesOwned;
    }

    const breakEvenPrice = side === 'YES' ? entryPrice : 1 - entryPrice;
    const maxLoss = Math.min(yesOutcomePnl, noOutcomePnl);
    const maxGain = Math.max(yesOutcomePnl, noOutcomePnl);

    return {
        yesOutcome: {
            resolvedAs: 'YES',
            pnl: yesOutcomePnl,
            pnlPercentage: (yesOutcomePnl / positionSize) * 100,
            exitPrice: side === 'YES' ? 1.0 : 0.0,
        },
        noOutcome: {
            resolvedAs: 'NO',
            pnl: noOutcomePnl,
            pnlPercentage: (noOutcomePnl / positionSize) * 100,
            exitPrice: side === 'YES' ? 0.0 : 1.0,
        },
        capitalLocked: positionSize,
        breakEvenPrice,
        maxLoss,
        maxGain,
        lockDurationDays: timeToResolutionDays,
    };
}

export const ResolutionSimulator: React.FC<Props> = ({ market }) => {
    const { liveData, isMockData } = useLiveMarketData(market);

    // Get current price from live data or fall back to market's latest candle
    const currentPrice = useMemo(() => {
        // Priority 1: Real candle data (most accurate for loaded markets)
        if (market.candles && market.candles.length > 0) {
            return market.candles[market.candles.length - 1].close;
        }

        // Priority 2: Live API data (only if not mock)
        if (liveData?.livePrice.price && !isMockData) {
            return liveData.livePrice.price;
        }

        // Priority 3: Mock data as last resort
        if (liveData?.livePrice.price && isMockData) {
            return liveData.livePrice.price;
        }

        return 0.5; // Default fallback
    }, [liveData, isMockData, market.candles]);

    const [input, setInput] = useState<SimulationInput>({
        positionSize: 1000,
        side: 'YES',
        entryPrice: currentPrice,
    });

    // Update entry price when current price changes
    React.useEffect(() => {
        setInput(prev => ({ ...prev, entryPrice: currentPrice }));
    }, [currentPrice]);

    const simulation = useMemo(() => {
        const timeToResolutionDays = liveData ? liveData.timeToResolution / 86400 : 0;
        return calculateSimulation(input, timeToResolutionDays);
    }, [input, liveData]);

    const profitCurveData = useMemo(() => {
        const data = [];
        const { positionSize, side, entryPrice } = input;

        for (let p = 0; p <= 1; p += 0.05) {
            let pnl: number;
            if (side === 'YES') {
                const sharesOwned = positionSize / entryPrice;
                pnl = (p - entryPrice) * sharesOwned;
            } else {
                const noEntryPrice = 1 - entryPrice;
                const sharesOwned = positionSize / noEntryPrice;
                pnl = ((1 - p) - noEntryPrice) * sharesOwned;
            }
            data.push({ price: p, pnl });
        }
        return data;
    }, [input]);

    const handlePositionSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(prev => ({ ...prev, positionSize: parseFloat(e.target.value) }));
    };

    const handleSideToggle = (side: 'YES' | 'NO') => {
        setInput(prev => ({ ...prev, side }));
    };

    return (
        <div className="bg-gradient-to-b from-[#121215] to-[#0C0C0E] rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FF6100] rounded-lg shadow-[0_0_20px_rgba(255,97,0,0.3)]">
                        <Target size={18} className="text-black" />
                    </div>
                    <div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white block">Resolution Simulator</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Position Outcome Analysis</span>
                    </div>
                </div>
                {isMockData && (
                    <div className="px-2 py-1 rounded bg-[#FFB800]/10 border border-[#FFB800]/30">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#FFB800]">Mock Data</span>
                    </div>
                )}
            </div>

            <div className="p-6 space-y-6">
                {/* Position Builder */}
                <div className="space-y-6">
                    {/* Position Size Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-data-header">Position Size</span>
                            <span className="text-xl font-black font-mono text-[#FF6100]">${input.positionSize.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="10000"
                            step="10"
                            value={input.positionSize}
                            onChange={handlePositionSizeChange}
                            className="cyber-range relative z-30 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                            <span>$10</span>
                            <span>$10,000</span>
                        </div>
                    </div>

                    {/* Side Toggle */}
                    <div className="space-y-3">
                        <span className="text-data-header">Position Side</span>
                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSideToggle('YES');
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 text-sm font-black uppercase tracking-widest transition-all relative z-20 cursor-pointer active:scale-95 ${input.side === 'YES'
                                    ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] shadow-[0_0_20px_rgba(0,255,156,0.2)]'
                                    : 'border-white/10 text-zinc-600 hover:border-white/20 hover:bg-white/5'
                                    }`}
                            >
                                BUY YES @ ${(Number(input.entryPrice) || 0).toFixed(2)}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSideToggle('NO');
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 text-sm font-black uppercase tracking-widest transition-all relative z-20 cursor-pointer active:scale-95 ${input.side === 'NO'
                                    ? 'bg-[#FF3E5E]/10 border-[#FF3E5E] text-[#FF3E5E] shadow-[0_0_20px_rgba(255,62,94,0.2)]'
                                    : 'border-white/10 text-zinc-600 hover:border-white/20 hover:bg-white/5'
                                    }`}
                            >
                                BUY NO @ ${(1 - (Number(input.entryPrice) || 0)).toFixed(2)}
                            </button>
                        </div>
                    </div>
                </div>

                {/* PnL Curve Visualization */}
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-data-header">Profit/Loss Curve Projection</span>
                        <div className="flex items-center gap-2">
                            <Info size={12} className="text-zinc-500" />
                            <span className="text-[9px] font-mono text-zinc-500 uppercase">Simulated Exit Range</span>
                        </div>
                    </div>
                    <div className="h-40 min-h-[160px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            <AreaChart data={profitCurveData}>
                                <defs>
                                    <linearGradient id="pnlCurveGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={(simulation.yesOutcome.pnl || 0) > 0 ? '#00FF9C' : '#FF3E5E'} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={(simulation.yesOutcome.pnl || 0) > 0 ? '#00FF9C' : '#FF3E5E'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis dataKey="price" hide />
                                <YAxis hide />
                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const pnl = Number(payload[0].value) || 0;
                                            return (
                                                <div className="glass-surface px-3 py-2 rounded-lg border border-white/10 shadow-2xl">
                                                    <div className="flex flex-col gap-1 text-[10px] font-mono">
                                                        <span className="text-zinc-500 uppercase tracking-widest text-[8px] font-black">Projected PnL</span>
                                                        <span className={pnl >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}>
                                                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                                        </span>
                                                        <span className="text-zinc-400">@ ${(Number(payload[0].payload.price) || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="pnl"
                                    stroke={simulation.yesOutcome.pnl > 0 ? '#00FF9C' : '#FF3E5E'}
                                    strokeWidth={3}
                                    fill="url(#pnlCurveGradient)"
                                    animationDuration={1000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>


                {/* Selected Position Outcome */}
                <div className="bg-black/40 rounded-xl p-6 border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-data-header">Position Outcome</span>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <div className={`w-2 h-2 rounded-full ${input.side === 'YES' ? 'bg-[#00FF9C]' : 'bg-[#FF3E5E]'} shadow-[0_0_10px_currentColor]`} />
                            <span className="text-xs font-black text-white uppercase tracking-wider">{input.side}</span>
                        </div>
                    </div>

                    {/* Outcome Display */}
                    <div className="space-y-4">
                        {/* If Your Side Wins */}
                        <div className="space-y-3 group relative">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold text-white">If {input.side} Wins</span>
                                    <span className="text-xs text-zinc-500 font-mono">Current odds: {((Number(input.entryPrice) || 0) * (input.side === 'YES' ? 100 : 0) + (input.side === 'NO' ? (1 - (Number(input.entryPrice) || 0)) * 100 : 0)).toFixed(1)}%</span>
                                </div>
                                <div className="text-right">
                                    <div className={`text-3xl font-black font-mono ${(input.side === 'YES' ? simulation.yesOutcome.pnl : simulation.noOutcome.pnl) >= 0 ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                                        {(input.side === 'YES' ? simulation.yesOutcome.pnl : simulation.noOutcome.pnl) >= 0 ? '+' : ''}${(Number(input.side === 'YES' ? simulation.yesOutcome.pnl : simulation.noOutcome.pnl) || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-zinc-400 font-mono mt-1">
                                        {(input.side === 'YES' ? simulation.yesOutcome.pnlPercentage : simulation.noOutcome.pnlPercentage) >= 0 ? '+' : ''}${(Number(input.side === 'YES' ? simulation.yesOutcome.pnlPercentage : simulation.noOutcome.pnlPercentage) || 0).toFixed(1)}% ROI
                                    </div>
                                </div>
                            </div>
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.abs(input.side === 'YES' ? simulation.yesOutcome.pnlPercentage : simulation.noOutcome.pnlPercentage))}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    className={`h-full ${(input.side === 'YES' ? simulation.yesOutcome.pnl : simulation.noOutcome.pnl) >= 0 ? 'bg-gradient-to-r from-[#00FF9C]/20 to-[#00FF9C]' : 'bg-gradient-to-r from-[#FF3E5E]/20 to-[#FF3E5E]'} rounded-full`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Risk Summary */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign size={14} className="text-emerald-500" />
                            <span className="text-data-header">Investment</span>
                        </div>
                        <span className="text-2xl font-black font-mono text-white">${simulation.capitalLocked.toLocaleString()}</span>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={14} className="text-[#00FF9C]" />
                            <span className="text-data-header">Max Profit</span>
                        </div>
                        <span className="text-2xl font-black font-mono text-[#00FF9C]">
                            +${Math.max(
                                input.side === 'YES' ? simulation.yesOutcome.pnl : simulation.noOutcome.pnl,
                                0
                            ).toFixed(2)}
                        </span>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={14} className="text-[#FF3E5E]" />
                            <span className="text-data-header">Max Loss</span>
                        </div>
                        <span className="text-2xl font-black font-mono text-[#FF3E5E]">-${Math.abs(simulation.maxLoss).toFixed(2)}</span>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Target size={14} className="text-zinc-500" />
                            <span className="text-data-header">Break-even</span>
                        </div>
                        <span className="text-2xl font-black font-mono text-zinc-300">${simulation.breakEvenPrice.toFixed(3)}</span>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock size={14} className="text-[#FFB800]" />
                            <span className="text-data-header">Lock Duration</span>
                        </div>
                        <span className="text-2xl font-black font-mono text-white">{simulation.lockDurationDays.toFixed(1)}d</span>
                    </div>
                </div>

                {/* Warning for High Risk */}
                {Math.abs(simulation.maxLoss) / simulation.capitalLocked > 0.5 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#FF3E5E]/10 border border-[#FF3E5E]/40 rounded-xl p-4 flex items-start gap-3"
                    >
                        <AlertTriangle size={20} className="text-[#FF3E5E] mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[#FF3E5E] mb-1">High Risk Position</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                This position carries a potential loss of over 50% of your capital. Consider reducing position size or waiting for better entry opportunities.
                            </p>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
