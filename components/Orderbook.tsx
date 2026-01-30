import React, { useState, useMemo } from 'react';
import { useOrderbook } from '../hooks/useLiveMarket';
import { OrderbookLevel } from '../types/liveMarket';
import { Activity, ArrowUpDown } from 'lucide-react';

interface OrderbookProps {
    yesTokenId?: string;
    noTokenId?: string;
    currentPrice?: number;
}

export const Orderbook: React.FC<OrderbookProps> = ({ yesTokenId, noTokenId, currentPrice }) => {
    const [activeSide, setActiveSide] = useState<'YES' | 'NO'>('YES');
    const tokenId = activeSide === 'YES' ? yesTokenId : noTokenId;

    const { orderbook, isLoading, isMockData } = useOrderbook(tokenId, 2000); // 2s refresh for orderbook

    const maxTotal = useMemo(() => {
        if (!orderbook) return 0;
        const maxBid = orderbook.bids.length > 0 ? orderbook.bids[orderbook.bids.length - 1].total : 0;
        const maxAsk = orderbook.asks.length > 0 ? orderbook.asks[orderbook.asks.length - 1].total : 0;
        return Math.max(maxBid, maxAsk);
    }, [orderbook]);

    const renderLevels = (levels: OrderbookLevel[], type: 'bid' | 'ask') => {
        // Show only top 10 levels for each
        const displayedLevels = type === 'bid' ? levels.slice(0, 10) : [...levels].reverse().slice(0, 10);

        return displayedLevels.map((level, i) => {
            const percentage = (level.total / maxTotal) * 100;
            return (
                <div key={`${type}-${level.price}-${i}`} className="relative group h-6 flex items-center px-4 overflow-hidden">
                    {/* Depth Bar */}
                    <div
                        className={`absolute right-0 top-0 bottom-0 opacity-10 transition-all duration-500 ${type === 'bid' ? 'bg-[#00FF9C]' : 'bg-[#FF3E5E]'}`}
                        style={{ width: `${percentage}%` }}
                    />

                    <div className="flex-1 grid grid-cols-3 gap-2 relative z-10">
                        <span className={`text-[10px] font-mono font-black ${type === 'bid' ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                            {level.price.toFixed(3)}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 text-right">
                            {level.size.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-[10px] font-mono text-white text-right font-bold">
                            {level.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="cyber-card flex flex-col bg-black/40 border-white/5 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[#FF6100]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">L2 DATASTREAM</span>
                </div>

                <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/10">
                    <button
                        onClick={() => setActiveSide('YES')}
                        className={`px-3 py-1 rounded-md text-[8px] font-black transition-all ${activeSide === 'YES' ? 'bg-[#00FF9C] text-black' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                        YES
                    </button>
                    <button
                        onClick={() => setActiveSide('NO')}
                        className={`px-3 py-1 rounded-md text-[8px] font-black transition-all ${activeSide === 'NO' ? 'bg-[#FF3E5E] text-black' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                        NO
                    </button>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.01]">
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Price</span>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-right">Size</span>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-right">Total</span>
            </div>

            {/* Orderbook Content */}
            <div className="flex-1 flex flex-col justify-between py-1 min-h-[400px]">
                {isLoading && !orderbook ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#FF6100]/20 border-t-[#FF6100] rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Asks Section */}
                        <div className="flex flex-col-reverse">
                            {orderbook && renderLevels(orderbook.asks, 'ask')}
                        </div>

                        {/* Current Price / Spread */}
                        <div className="my-2 py-3 bg-white/[0.03] border-y border-white/5 flex items-center justify-between px-4">
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-mono font-black text-white">
                                    {currentPrice ? currentPrice.toFixed(3) : '---'}
                                </span>
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">USD</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1 text-[9px] font-black text-[#FF6100]">
                                    <ArrowUpDown size={10} />
                                    <span>SPREAD: {orderbook?.spreadPercentage.toFixed(2)}%</span>
                                </div>
                                {isMockData && (
                                    <span className="text-[7px] text-[#FFB800] font-black uppercase mt-1 tracking-widest">Simulated Feed</span>
                                )}
                            </div>
                        </div>

                        {/* Bids Section */}
                        <div className="flex flex-col">
                            {orderbook && renderLevels(orderbook.bids, 'bid')}
                        </div>
                    </>
                )}
            </div>

            {/* Status Bar */}
            <div className="px-4 py-2 border-t border-white/5 bg-black/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isMockData ? 'bg-[#FFB800]' : 'bg-[#00FF9C]'} animate-pulse`} />
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                        {isMockData ? 'SANDBOX_MODE_ACTIVE' : 'LIVE_DATAFEED_SYNCHRONIZED'}
                    </span>
                </div>
                <span className="text-[8px] font-mono text-zinc-600">
                    {orderbook ? new Date(orderbook.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                </span>
            </div>
        </div>
    );
};
