/**
 * Opinion Scanner - Premium Market Analytics
 * Elegant outcome-focused design with category navigation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter,
    ChevronDown,
    Clock,
    BarChart2
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

                                const outcomes = [
                                    { label: 'YES', percent: yesPrice, color: '#10B981' },
                                    { label: 'NO', percent: noPrice, color: '#EF4444' }
                                ];

                                return (
                                    <motion.div
                                        key={market.marketId}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                        onClick={() => openMarketPage(market.marketId)}
                                        className="bg-[#0A0A0A] rounded-2xl p-5 border border-white/[0.08] hover:border-[#10B981]/30 transition-all duration-300 group cursor-pointer flex flex-col"
                                    >
                                        {/* Header */}
                                        <div className="flex gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                                <img
                                                    src={getMarketImage(market.marketId.toString())}
                                                    alt={market.marketTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[15px] font-bold text-white leading-snug mb-2 line-clamp-2">
                                                    {market.marketTitle}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 rounded-md bg-[#4C1D95]/40 border border-[#8B5CF6]/30 text-[10px] font-bold text-[#A78BFA] uppercase tracking-wide">
                                                        Crypto
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Outcomes List */}
                                        <div className="space-y-5 mb-6 flex-1">
                                            {outcomes.map((outcome, idx) => (
                                                <div key={idx} className="relative">
                                                    {/* Top Row: Label + Stats + Buttons */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[13px] font-semibold text-white/90">
                                                            {outcome.label}
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[13px] font-mono text-white/70">
                                                                {outcome.percent.toFixed(0)}%
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <button className="h-6 px-1.5 rounded-[4px] bg-[#10B981]/10 border border-[#10B981]/30 text-[10px] font-bold text-[#10B981] hover:bg-[#10B981]/20 transition-colors">
                                                                    YES
                                                                </button>
                                                                <button className="h-6 px-1.5 rounded-[4px] bg-[#EF4444]/10 border border-[#EF4444]/30 text-[10px] font-bold text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors">
                                                                    NO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="h-1 w-full bg-white/[0.08] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${outcome.percent}%`,
                                                                backgroundColor: outcome.color
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* "Show all" Link */}
                                        <div className="flex justify-center mb-6">
                                            <button className="text-[11px] font-medium text-[#6366F1] flex items-center gap-1 hover:text-[#818CF8] transition-colors">
                                                Show all outcomes
                                                <ChevronDown size={12} />
                                            </button>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] text-[#888888]">
                                            <div className="flex items-center gap-2">
                                                <BarChart2 size={14} />
                                                <span className="text-xs font-medium">{formatVolume(market.volume24h || '0')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                <span className="text-xs font-medium">{formatDate(market.createdAt)}</span>
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
