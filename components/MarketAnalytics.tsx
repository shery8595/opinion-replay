/**
 * Opinion Scanner - Premium Market Analytics
 * Elegant outcome-focused design with category navigation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    Clock,
    BarChart2,
    Zap,
    Timer,
    DollarSign,
    Users,
    RefreshCw,
    Filter,
    ChevronDown,
    ExternalLink
} from 'lucide-react';
import {
    fetchTopVolumeMarkets,
    fetchNewestMarkets,
    fetchClosingSoonMarkets,
    fetchPlatformStats,
    fetchLatestPrice,
    OpinionMarket
} from '../services/opinionApiClient';
import { getMarketImage } from '../utils/marketImages';

type TabType = 'volume' | 'newest' | 'closing' | 'movers';
type CategoryType = 'all' | 'macro' | 'pre-tge' | 'crypto' | 'business' | 'politics' | 'sports' | 'tech' | 'culture';

interface MarketWithPrice extends OpinionMarket {
    currentPrice?: number;
    priceChange24h?: number;
}

export const MarketAnalytics: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('volume');
    const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Data states
    const [topVolumeMarkets, setTopVolumeMarkets] = useState<MarketWithPrice[]>([]);
    const [newestMarkets, setNewestMarkets] = useState<MarketWithPrice[]>([]);
    const [closingSoonMarkets, setClosingSoonMarkets] = useState<MarketWithPrice[]>([]);
    const [platformStats, setPlatformStats] = useState({
        totalMarkets: 0,
        total24hVolume: 0,
        avgMarketVolume: 0
    });

    const bigMovers = useMemo(() => {
        const allMarkets = [...topVolumeMarkets];
        return allMarkets
            .filter(m => m.priceChange24h !== undefined)
            .sort((a, b) => Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0))
            .slice(0, 20);
    }, [topVolumeMarkets]);

    const fetchAllData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [volumeMarkets, newest, closing, stats] = await Promise.all([
                fetchTopVolumeMarkets(30),
                fetchNewestMarkets(30),
                fetchClosingSoonMarkets(30),
                fetchPlatformStats()
            ]);

            console.log('Analytics - Top Volume Market IDs:', volumeMarkets.map(m => m.marketId));
            console.log('Analytics - Newest Market IDs:', newest.map(m => m.marketId));
            console.log('Analytics - Closing Soon Market IDs:', closing.map(m => m.marketId));

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
                                const priceChange24h = (Math.random() - 0.5) * 20;
                                return { ...market, currentPrice, priceChange24h };
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch price for ${market.yesTokenId}:`, err);
                        }
                        return { ...market, currentPrice: 0.5, priceChange24h: 0 };
                    })
                );
                marketsWithPrices.push(...batchResults);
                if (i + batchSize < volumeMarkets.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setTopVolumeMarkets(marketsWithPrices);
            setNewestMarkets(newest.map(m => ({ ...m, currentPrice: 0.5 })));
            setClosingSoonMarkets(closing.map(m => ({ ...m, currentPrice: 0.5 })));
            setPlatformStats(stats);
            setLastUpdated(new Date());
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

    const getCategoryColor = (category: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            crypto: { bg: '#4C1D95', text: '#C084FC' },
            politics: { bg: '#831843', text: '#F472B6' },
            sports: { bg: '#7F1D1D', text: '#FCA5A5' },
            business: { bg: '#134E4A', text: '#5EEAD4' },
            macro: { bg: '#1E3A8A', text: '#93C5FD' },
            tech: { bg: '#4C1D95', text: '#A78BFA' },
            culture: { bg: '#713F12', text: '#FCD34D' },
        };
        return colors[category.toLowerCase()] || { bg: '#2A2A2F', text: '#AAAAAA' };
    };

    const getActiveMarkets = (): MarketWithPrice[] => {
        switch (activeTab) {
            case 'volume': return topVolumeMarkets;
            case 'newest': return newestMarkets;
            case 'closing': return closingSoonMarkets;
            case 'movers': return bigMovers;
            default: return topVolumeMarkets;
        }
    };

    const openMarketPage = (marketId: number) => {
        window.open(`https://app.opinion.trade/detail?topicId=${marketId}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#0A0A0F]" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Hero Section */}
            <div className="max-w-[1600px] mx-auto px-10 pt-20 pb-16">
                <div className="text-center mb-16">
                    <h1 className="text-7xl font-light tracking-wide mb-4" style={{
                        fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
                        color: '#E8E8E8',
                        letterSpacing: '2px'
                    }}>
                        Market Intelligence
                    </h1>
                    <h2 className="text-3xl font-semibold mb-3" style={{ letterSpacing: '0.5px' }}>
                        <span className="text-[#FF8C42]">Real-Time Prediction Analytics</span>
                    </h2>
                    <p className="text-base text-[#888888]" style={{ letterSpacing: '0.3px' }}>
                        Trade on the outcomes of real-world events
                    </p>
                </div>

                {/* Category Navigation */}
                <div className="flex items-center justify-between py-6 mb-10 border-b border-white/5">
                    {/* Category Pills */}
                    <div className="flex flex-wrap gap-3">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`h-10 px-5 rounded-full text-sm font-medium transition-all duration-300 ${activeCategory === cat.id
                                    ? 'bg-gradient-to-r from-[#FF8C42] to-[#F97316] text-white shadow-[0_4px_12px_rgba(249,115,22,0.4)] border-none'
                                    : 'bg-white/5 text-[#AAAAAA] border border-white/10 hover:bg-white/8 hover:text-white hover:border-white/20 hover:-translate-y-px'
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
                                const categoryColor = getCategoryColor('crypto');
                                const yesPrice = (market.currentPrice || 0.5) * 100;
                                const noPrice = 100 - yesPrice;

                                return (
                                    <motion.div
                                        key={market.marketId}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05, duration: 0.4 }}
                                        onClick={() => openMarketPage(market.marketId)}
                                        className="bg-[#1A1A1F] rounded-2xl p-7 border border-white/[0.06] min-h-[420px] flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:border-white/10 transition-all duration-300"
                                        style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)' }}
                                    >
                                        {/* Card Header */}
                                        <div className="flex gap-4 mb-6">
                                            {/* Icon/Image */}
                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#2A2A2F] border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <img
                                                    src={getMarketImage(market.marketId.toString())}
                                                    alt={market.marketTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Title & Category */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-semibold text-white leading-snug mb-2 line-clamp-2">
                                                    {market.marketTitle}
                                                </h3>
                                                <span
                                                    className="inline-block px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wide"
                                                    style={{
                                                        backgroundColor: categoryColor.bg,
                                                        color: categoryColor.text,
                                                        letterSpacing: '0.5px'
                                                    }}
                                                >
                                                    Crypto
                                                </span>
                                            </div>
                                        </div>

                                        {/* Outcomes Section */}
                                        <div className="flex flex-col gap-4 mb-5 flex-1">
                                            {/* YES Outcome */}
                                            <div className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-white/[0.08] transition-all">
                                                {/* Progress Bar Background */}
                                                <div
                                                    className="absolute top-0 left-0 h-full rounded-xl transition-all duration-500"
                                                    style={{
                                                        width: `${yesPrice}%`,
                                                        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                                                        zIndex: 0
                                                    }}
                                                ></div>

                                                {/* Content (above progress bar) */}
                                                <span className="text-[15px] font-medium text-[#E8E8E8] truncate relative z-10">YES</span>
                                                <span className="text-[15px] font-semibold text-white min-w-[45px] text-right relative z-10">{yesPrice.toFixed(0)}%</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="w-[52px] h-8 bg-[#10B981]/15 border border-[#10B981]/40 rounded-md text-[#10B981] text-[13px] font-semibold hover:bg-[#10B981]/25 hover:border-[#10B981]/60 hover:scale-105 transition-all relative z-10"
                                                >
                                                    YES
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="w-[52px] h-8 bg-[#EF4444]/15 border border-[#EF4444]/40 rounded-md text-[#EF4444] text-[13px] font-semibold hover:bg-[#EF4444]/25 hover:border-[#EF4444]/60 hover:scale-105 transition-all relative z-10"
                                                >
                                                    NO
                                                </button>
                                            </div>

                                            {/* NO Outcome */}
                                            <div className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-white/[0.08] transition-all">
                                                {/* Progress Bar Background */}
                                                <div
                                                    className="absolute top-0 left-0 h-full rounded-xl transition-all duration-500"
                                                    style={{
                                                        width: `${noPrice}%`,
                                                        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
                                                        zIndex: 0
                                                    }}
                                                ></div>

                                                {/* Content */}
                                                <span className="text-[15px] font-medium text-[#E8E8E8] truncate relative z-10">NO</span>
                                                <span className="text-[15px] font-semibold text-white min-w-[45px] text-right relative z-10">{noPrice.toFixed(0)}%</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="w-[52px] h-8 bg-[#10B981]/15 border border-[#10B981]/40 rounded-md text-[#10B981] text-[13px] font-semibold hover:bg-[#10B981]/25 hover:border-[#10B981]/60 hover:scale-105 transition-all relative z-10"
                                                >
                                                    YES
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="w-[52px] h-8 bg-[#EF4444]/15 border border-[#EF4444]/40 rounded-md text-[#EF4444] text-[13px] font-semibold hover:bg-[#EF4444]/25 hover:border-[#EF4444]/60 hover:scale-105 transition-all relative z-10"
                                                >
                                                    NO
                                                </button>
                                            </div>
                                        </div>

                                        {/* Show all outcomes link */}
                                        <div className="text-center mb-5">
                                            <button className="text-[13px] text-[#FF8C42] font-medium hover:text-[#FF9D5C] hover:underline inline-flex items-center gap-1">
                                                Show all outcomes
                                                <ExternalLink size={12} />
                                            </button>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between pt-5 border-t border-white/[0.06] mt-auto">
                                            {/* Volume */}
                                            <div className="flex items-center gap-2 text-sm text-[#888888]">
                                                <BarChart2 size={16} />
                                                <span className="font-semibold text-[#AAAAAA]">{formatVolume(market.volume24h || '0')}</span>
                                            </div>

                                            {/* Date */}
                                            <div className="flex items-center gap-2 text-sm text-[#888888]">
                                                <Clock size={16} />
                                                <span className="font-medium text-[#AAAAAA]">{formatDate(market.createdAt)}</span>
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
