/**
 * Opinion Scanner - Premium Market Analytics
 * Elegant outcome-focused design with category navigation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter,
    ChevronDown,
    ExternalLink,
    Zap
} from 'lucide-react';
import {
    fetchTopVolumeMarkets,
    fetchLatestPrice,
    OpinionMarket
} from '../services/opinionApiClient';
import { getMarketImage } from '../utils/marketImages';

type CategoryType = 'all' | 'macro' | 'pre-tge' | 'crypto' | 'business' | 'politics' | 'sports' | 'tech' | 'culture';

interface MarketWithPrice extends OpinionMarket {
    currentPrice?: number;
    priceChange24h?: number;
}

export const MarketAnalytics: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data states
    const [topVolumeMarkets, setTopVolumeMarkets] = useState<MarketWithPrice[]>([]);

    const fetchAllData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [volumeMarkets] = await Promise.all([
                fetchTopVolumeMarkets(30)
            ]);

            const marketsWithPrices: any[] = [];
            const batchSize = 5;
            for (let i = 0; i < volumeMarkets.length; i += batchSize) {
                const batch = volumeMarkets.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (market) => {
                        try {
                            if (market.yesTokenId) {
                                const priceData = await fetchLatestPrice(market.yesTokenId);
                                const currentPrice = parseFloat(priceData.price);
                                return { ...market, currentPrice };
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch price for ${market.yesTokenId}:`, err);
                        }
                        return { ...market, currentPrice: 0.5 };
                    })
                );
                marketsWithPrices.push(...batchResults);
                if (i + batchSize < volumeMarkets.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setTopVolumeMarkets(marketsWithPrices);
        } catch (err) {
            console.error('Failed to fetch market analytics:', err);
            setError('Failed to load market data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatVolume = (vol: string | number): string => {
        const num = typeof vol === 'string' ? parseFloat(vol) : vol;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const categories = [
        { id: 'all' as CategoryType, label: 'All' },
        { id: 'macro' as CategoryType, label: 'Macro' },
        { id: 'pre-tge' as CategoryType, label: 'Pre-TGE' },
        { id: 'crypto' as CategoryType, label: 'Crypto' },
        { id: 'business' as CategoryType, label: 'Business' },
        { id: 'politics' as CategoryType, label: 'Politics' },
        { id: 'sports' as CategoryType, label: 'Sports' },
        { id: 'tech' as CategoryType, label: 'Tech' },
        { id: 'culture' as CategoryType, label: 'Culture' },
    ];

    const getActiveMarkets = (): MarketWithPrice[] => {
        return topVolumeMarkets;
    };

    const openMarketPage = (marketId: number) => {
        window.open(`https://app.opinion.trade/detail?topicId=${marketId}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#0A0A0F]" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Hero Section - Institutional Style */}
            <div className="max-w-[1600px] mx-auto px-8 pt-16 pb-12">
                <div className="text-center mb-16 relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#FF6100]/5 blur-[120px] rounded-full -z-10"
                    />
                    <h1 className="text-6xl font-light tracking-tight mb-4" style={{
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        color: '#FFFFFF',
                        letterSpacing: '-1px'
                    }}>
                        Market <span className="font-black italic text-[#FF6100]">Intelligence</span>
                    </h1>
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#FF6100]/40" />
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500">
                            Real-Time Institutional Terminal
                        </h2>
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#FF6100]/40" />
                    </div>
                </div>

                {/* Enhanced Navigation Bar */}
                <div className="flex items-center justify-between py-4 mb-10 border-b border-white/[0.06] backdrop-blur-md sticky top-0 z-30">
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeCategory === cat.id
                                    ? 'bg-[#FF6100] text-white shadow-[0_4px_12px_rgba(255,97,0,0.3)]'
                                    : 'bg-white/5 text-zinc-500 border border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Right Controls */}
                    <div className="flex gap-4">
                        <button className="h-10 px-5 bg-white/5 border border-white/10 rounded-lg text-white text-sm flex items-center gap-2 hover:bg-white/8 transition-all">
                            <Filter size={16} />
                            Filters
                        </button>
                        <button className="h-10 px-5 bg-white/5 border border-white/10 rounded-lg text-white text-sm flex items-center gap-2 hover:bg-white/8 transition-all">
                            24h Volume
                            <ChevronDown size={12} />
                        </button>
                    </div>
                </div>

                {/* Markets Grid */}
                {error ? (
                    <div className="p-12 text-center">
                        <div className="text-[#DC2626] text-sm font-semibold mb-2">{error}</div>
                        <button onClick={fetchAllData} className="text-[#5B5BFF] text-sm font-semibold hover:underline">
                            Try Again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 gap-y-8">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-[#1A1A1F] rounded-2xl p-7 border border-white/[0.06] min-h-[420px] animate-pulse"></div>
                        ))}
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeCategory}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 gap-y-6"
                            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
                        >
                            {getActiveMarkets().slice(0, 12).map((market, index) => {
                                const yesPrice = (market.currentPrice || 0.5) * 100;
                                const noPrice = 100 - yesPrice;

                                return (
                                    <motion.div
                                        key={market.marketId}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05, duration: 0.4 }}
                                        onClick={() => openMarketPage(market.marketId)}
                                        className="bg-[rgba(20,20,25,0.7)] rounded-2xl p-6 border border-white/[0.06] flex flex-col cursor-pointer hover:-translate-y-1 hover:border-[#FF6100]/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-400 group relative overflow-hidden"
                                    >
                                        {/* Premium Subtle Pattern */}
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF6100]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#FF6100]/5 blur-2xl rounded-full" />

                                        {/* Card Header */}
                                        <div className="flex gap-4 mb-5 relative z-10">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                                <img
                                                    src={getMarketImage(market.marketId.toString())}
                                                    alt={market.marketTitle}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black text-[#FF6100] px-1.5 py-0.5 bg-[#FF6100]/10 border border-[#FF6100]/20 rounded uppercase tracking-tighter">
                                                        #{market.marketId}
                                                    </span>
                                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Market</span>
                                                </div>
                                                <h3 className="text-[15px] font-bold text-white leading-tight line-clamp-2 italic">
                                                    {market.marketTitle}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Outcomes Section - Institutional Design */}
                                        <div className="space-y-3 mb-5 relative z-10">
                                            {/* YES Bar */}
                                            <div className="relative group/bar overflow-hidden rounded-lg bg-black/40 border border-white/5 h-10 flex items-center justify-between px-4 transition-all hover:border-emerald-500/30">
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent transition-all duration-1000"
                                                    style={{ width: `${yesPrice}%` }}
                                                />
                                                <div className="flex items-center gap-2 relative z-10">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                                    <span className="text-[10px] font-black text-white tracking-[0.2em]">YES</span>
                                                </div>
                                                <div className="flex items-center gap-3 relative z-10">
                                                    <span className="text-xs font-bold text-emerald-400 font-mono italic">{yesPrice.toFixed(1)}%</span>
                                                    <div className="h-6 w-px bg-white/10" />
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bid</span>
                                                </div>
                                            </div>

                                            {/* NO Bar */}
                                            <div className="relative group/bar overflow-hidden rounded-lg bg-black/40 border border-white/5 h-10 flex items-center justify-between px-4 transition-all hover:border-rose-500/30">
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent transition-all duration-1000"
                                                    style={{ width: `${noPrice}%` }}
                                                />
                                                <div className="flex items-center gap-2 relative z-10">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                                    <span className="text-[10px] font-black text-white tracking-[0.2em]">NO</span>
                                                </div>
                                                <div className="flex items-center gap-3 relative z-10">
                                                    <span className="text-xs font-bold text-rose-400 font-mono italic">{noPrice.toFixed(1)}%</span>
                                                    <div className="h-6 w-px bg-white/10" />
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ask</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-2 gap-2 mb-5 relative z-10">
                                            <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center justify-between">
                                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">VOL_24H</span>
                                                <span className="text-xs font-bold text-zinc-200">{formatVolume(market.volume24h || '0')}</span>
                                            </div>
                                            <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center justify-between">
                                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">CL_SOON</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Zap size={10} className="text-[#FFB84D]" />
                                                    <span className="text-xs font-bold text-[#FFB84D]">{formatDate(market.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05] mt-auto relative z-10">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-[#FF6100]/5 border border-[#FF6100]/20 rounded-lg group-hover:bg-[#FF6100]/10 transition-colors">
                                                <span className="text-[9px] font-black text-[#FF6100] uppercase tracking-widest">Open Analytics</span>
                                                <ExternalLink size={10} className="text-[#FF6100]" />
                                            </div>
                                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                                Institutional Feed
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
