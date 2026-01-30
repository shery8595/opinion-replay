/**
 * Market Reminders Dashboard
 * Sophisticated 3-column monitoring interface with enhanced UX
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Search,
    Target,
    BarChart2,
    Clock,
    Users,
    Zap,
    ShieldCheck,
    Info,
    X,
    CheckCircle2
} from 'lucide-react';
import {
    fetchActiveMarkets,
    fetchLatestPrice,
    OpinionMarket
} from '../services/opinionApiClient';
import { getMarketImage } from '../utils/marketImages';

// TYPES
type AlertType = 'price' | 'resolution' | 'time';

interface MarketAlert {
    id: string;
    marketId: number;
    marketTitle: string;
    type: AlertType;
    tokenId?: string;
    tokenSide?: 'YES' | 'NO';
    targetPrice?: number;
    hoursBefore?: number;
    triggered: boolean;
    status: 'active' | 'triggered' | 'failed';
    createdAt: number;
}

const STORAGE_KEY = 'opinion_market_alerts';

export const MarketReminder: React.FC = () => {
    // STATE
    const [markets, setMarkets] = useState<OpinionMarket[]>([]);
    const [alerts, setAlerts] = useState<MarketAlert[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState<OpinionMarket | null>(null);
    const [selectedMarket, setSelectedMarket] = useState<number | null>(null);

    // Modal form state
    const [alertType, setAlertType] = useState<AlertType>('price');
    const [tokenSide, setTokenSide] = useState<'YES' | 'NO'>('YES');
    const [targetPrice, setTargetPrice] = useState<string>('0.50');
    const [hoursBefore, setHoursBefore] = useState<string>('24');

    const checkTimer = useRef<NodeJS.Timeout | null>(null);

    // INITIALIZATION
    useEffect(() => {
        const savedAlerts = localStorage.getItem(STORAGE_KEY);
        if (savedAlerts) {
            try {
                setAlerts(JSON.parse(savedAlerts));
            } catch (e) {
                console.error('Failed to parse alerts', e);
            }
        }

        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        loadMarkets();
        startPolling();

        return () => {
            if (checkTimer.current) clearInterval(checkTimer.current);
        };
    }, []);

    // API LOGIC
    const loadMarkets = async () => {
        try {
            const data = await fetchActiveMarkets(3, 50);
            setMarkets(data);
        } catch (err) {
            console.error('Failed to load markets', err);
        }
    };

    const startPolling = () => {
        if (checkTimer.current) clearInterval(checkTimer.current);
        checkTimer.current = setInterval(checkAlerts, 60000);
    };

    // NOTIFICATION LOGIC
    const sendNotification = (title: string, body: string, icon?: string) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: icon || '/favicon.ico',
                badge: '/favicon.ico',
            });
        }
    };

    const checkAlerts = async () => {
        for (const alert of alerts) {
            if (alert.triggered || !alert.tokenId) continue;

            try {
                const priceData = await fetchLatestPrice(alert.tokenId);
                const currentPrice = parseFloat(priceData.price);

                if (alert.type === 'price' && alert.targetPrice) {
                    const shouldTrigger =
                        alert.tokenSide === 'YES'
                            ? currentPrice >= alert.targetPrice
                            : currentPrice <= alert.targetPrice;

                    if (shouldTrigger) {
                        sendNotification(
                            `🎯 Alert: ${alert.marketTitle}`,
                            `${alert.tokenSide} token reached ${currentPrice.toFixed(2)}`
                        );
                        updateAlertStatus(alert.id, true);
                    }
                }
            } catch (err) {
                console.error(`Failed to check alert ${alert.id}`, err);
            }
        }
    };

    // CRUD
    const addAlert = () => {
        if (!showModal) return;

        const newAlert: MarketAlert = {
            id: `${Date.now()}`,
            marketId: showModal.marketId,
            marketTitle: showModal.marketTitle,
            type: alertType,
            tokenId: alertType === 'price' ? showModal.yesTokenId : undefined,
            tokenSide: alertType === 'price' ? tokenSide : undefined,
            targetPrice: alertType === 'price' ? parseFloat(targetPrice) : undefined,
            hoursBefore: alertType === 'time' ? parseInt(hoursBefore) : undefined,
            triggered: false,
            status: 'active',
            createdAt: Date.now(),
        };

        const updatedAlerts = [...alerts, newAlert];
        setAlerts(updatedAlerts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlerts));
        setShowModal(null);
    };

    const deleteAlert = (id: string) => {
        const updatedAlerts = alerts.filter(a => a.id !== id);
        setAlerts(updatedAlerts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlerts));
    };

    const updateAlertStatus = (id: string, triggered: boolean) => {
        const updatedAlerts = alerts.map(a =>
            a.id === id ? { ...a, triggered, status: (triggered ? 'triggered' : 'active') as 'active' | 'triggered' } : a
        );
        setAlerts(updatedAlerts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlerts));
    };


    const formatVolume = (vol: string | number): string => {
        const num = typeof vol === 'string' ? parseFloat(vol) : vol;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    const filteredMarkets = markets.filter(m =>
        m.marketTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeAlerts = alerts.filter(a => !a.triggered);

    return (
        <div className="min-h-screen bg-[#0A0A0F] font-sans">
            {/* Main Container - Full Width */}
            <div className="w-full px-4 py-3">
                {/* 3-Column Layout - Optimized Widths */}
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] gap-4">

                    {/* LEFT SIDEBAR - Market Library */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="flex flex-col h-fit sticky top-4"
                    >
                        <div className="bg-[rgba(20,20,25,0.6)] border border-white/[0.08] rounded-xl p-4 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-5">
                                <Target size={14} className="text-[#FF8C42]" />
                                <span className="text-xs font-semibold text-[#FF8C42] uppercase tracking-wide">Market Library</span>
                            </div>

                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-10 bg-white/5 border-[1.5px] border-white/10 rounded-xl pl-10 pr-3 text-xs text-white placeholder:text-[#666666] focus:outline-none focus:border-[#FF8C42] transition-all"
                                />
                            </div>

                            {/* Market Cards */}
                            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#FF8C42]/40 scrollbar-track-white/5">
                                {filteredMarkets.slice(0, 20).map((market, index) => (
                                    <motion.div
                                        key={market.marketId}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => setSelectedMarket(market.marketId)}
                                        className={`relative p-3 rounded-xl cursor-pointer transition-all duration-300 ${selectedMarket === market.marketId
                                            ? 'bg-[rgba(255,140,66,0.08)] border border-[rgba(255,140,66,0.3)] shadow-[-3px_0_0_0_#FF8C42]'
                                            : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] hover:translate-x-1 hover:shadow-[-3px_0_0_0_#FF8C42]'
                                            }`}
                                    >
                                        <div className="flex gap-2.5 items-start mb-2.5">
                                            {/* Market Image */}
                                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10">
                                                <img
                                                    src={getMarketImage(market.marketId.toString())}
                                                    alt={market.marketTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="flex flex-col flex-1 min-w-0">
                                                {/* Market ID */}
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[9px] font-mono font-medium text-[#666666]">#{market.marketId}</span>
                                                </div>

                                                {/* Title */}
                                                <h4 className="text-[12px] font-medium text-white leading-tight mb-1 line-clamp-2">
                                                    {market.marketTitle}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-xs text-[#FFB84D] font-semibold">
                                                <BarChart2 size={12} />
                                                {formatVolume(market.volume24h || '0')}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-[#888888]">
                                                <Users size={12} />
                                                {Math.floor(Math.random() * 300 + 50)}
                                            </div>
                                        </div>

                                        {/* YES Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowModal(market);
                                            }}
                                            className="absolute top-3 right-3 w-10 h-6 bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.4)] rounded text-[#10B981] text-[10px] font-bold hover:bg-[rgba(16,185,129,0.25)] transition-all"
                                        >
                                            YES
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* MAIN CONTENT - Market Browser */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-gradient-to-br from-[#FF8C42] to-[#FF7B2F] rounded-lg flex items-center justify-center">
                                    <Search size={14} className="text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Market Browser</h2>
                            </div>

                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                                <input
                                    type="text"
                                    placeholder="Probe markets..."
                                    className="w-[200px] h-9 bg-white/5 border-[1.5px] border-white/10 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-[#666666] focus:outline-none focus:border-[#FF8C42] transition-all"
                                />
                            </div>
                        </div>

                        {/* Market Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredMarkets.slice(0, 12).map((market, index) => (
                                <motion.div
                                    key={market.marketId}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.4 }}
                                    className="relative bg-[rgba(20,20,25,0.8)] border border-white/[0.08] rounded-xl p-5 backdrop-blur-lg overflow-hidden hover:-translate-y-1 hover:border-[rgba(255,140,66,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,140,66,0.2)] transition-all duration-400 cursor-pointer group"
                                >
                                    {/* Background Accent */}
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle,rgba(255,140,66,0.08)_0%,transparent_70%)] pointer-events-none" />

                                    {/* Header Row */}
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[11px] font-mono font-semibold text-[#666666] px-3 py-1 bg-white/5 border border-white/[0.08] rounded-md">
                                                #{market.marketId}
                                            </span>
                                            <div className="flex items-center gap-2 text-xs text-[#FFB84D] font-semibold">
                                                <BarChart2 size={12} />
                                                {formatVolume(market.volume24h || '0')}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                            <span className="px-3 py-1 bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] rounded-md text-[#10B981] text-[10px] font-bold uppercase tracking-wide">
                                                Live
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title Section with Image */}
                                    <div className="flex gap-5 mb-6 relative z-10">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/10">
                                            <img
                                                src={getMarketImage(market.marketId.toString())}
                                                alt={market.marketTitle}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-white leading-snug line-clamp-2">
                                                {market.marketTitle}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-6 p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl relative z-10">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] text-[#888888] uppercase tracking-wide font-medium">YES Tokens</span>
                                            <span className="text-base text-[#10B981] font-semibold font-mono">{Math.floor(Math.random() * 50000 + 10000)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] text-[#888888] uppercase tracking-wide font-medium">Expiry</span>
                                            <div className="flex items-center gap-2 text-base text-[#FFB84D] font-semibold">
                                                <Clock size={14} />
                                                {Math.floor(Math.random() * 30 + 1)}d
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 relative z-10">
                                        <button
                                            onClick={() => setShowModal(market)}
                                            className="flex-1 h-12 bg-gradient-to-r from-[rgba(255,140,66,0.2)] to-[rgba(255,123,47,0.2)] border-[1.5px] border-[rgba(255,140,66,0.5)] rounded-xl text-[#FF8C42] text-sm font-semibold uppercase tracking-wide hover:from-[rgba(255,140,66,0.3)] hover:to-[rgba(255,123,47,0.3)] hover:border-[rgba(255,140,66,0.8)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(255,140,66,0.25)] transition-all"
                                        >
                                            Deploy Alert
                                        </button>
                                        <button className="w-12 h-12 bg-white/5 border-[1.5px] border-white/10 rounded-xl text-white flex items-center justify-center hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5 transition-all">
                                            <Info size={20} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* RIGHT SIDEBAR - System Monitoring */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="flex flex-col gap-4 h-fit sticky top-4"
                    >
                        {/* System Health */}
                        <div className="bg-[rgba(20,20,25,0.6)] border border-white/[0.08] rounded-xl p-4 backdrop-blur-lg">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wide">System Health</span>
                                <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_0_3px_rgba(16,185,129,0.2),0_0_12px_rgba(16,185,129,0.6)] animate-pulse" />
                            </div>

                            <div className="p-2.5 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] rounded-lg flex items-center justify-between">
                                <span className="text-sm font-bold text-[#10B981] uppercase tracking-wide">Granted</span>
                                <div className="w-8 h-8 bg-[rgba(16,185,129,0.2)] border-2 border-[rgba(16,185,129,0.4)] rounded-lg flex items-center justify-center">
                                    <CheckCircle2 size={16} className="text-[#10B981]" />
                                </div>
                            </div>
                        </div>

                        {/* Active Monitors */}
                        <div className="bg-[rgba(20,20,25,0.6)] border border-white/[0.08] rounded-xl p-4 backdrop-blur-lg">
                            <div className="flex items-center justify-between mb-5">
                                <span className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Active Monitors</span>
                                <div className="w-7 h-7 bg-[#FF8C42] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-[0_0_12px_rgba(255,140,66,0.4)]">
                                    {activeAlerts.length}
                                </div>
                            </div>

                            {activeAlerts.length > 0 ? (
                                <div className="space-y-3">
                                    {activeAlerts.slice(0, 3).map(alert => (
                                        <div key={alert.id} className="p-3 bg-[rgba(255,140,66,0.08)] border border-[rgba(255,140,66,0.2)] rounded-xl">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="text-xs text-white font-medium line-clamp-1">{alert.marketTitle}</span>
                                                <button
                                                    onClick={() => deleteAlert(alert.id)}
                                                    className="text-[#FF8C42] hover:text-[#FFB84D] transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Target size={12} className="text-[#FF8C42]" />
                                                <span className="text-[10px] text-[#888888] uppercase font-medium">{alert.type} alert</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 flex flex-col items-center gap-3 bg-white/[0.02] border border-dashed border-white/10 rounded-lg">
                                    <Zap size={48} className="text-[#444444] opacity-50" />
                                    <p className="text-sm text-[#666666] text-center leading-relaxed">
                                        No Active Units Deployed
                                    </p>
                                    <span className="text-xs text-[#FF8C42] font-semibold cursor-pointer hover:text-[#FFB84D] transition-colors">
                                        Deploy from browser →
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Persistence Engine */}
                        <div className="bg-[rgba(20,20,25,0.6)] border border-white/[0.08] rounded-xl p-4 backdrop-blur-lg">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[11px] font-semibold text-[#888888] uppercase tracking-wide">Persistence Engine</span>
                            </div>

                            <div className="p-4 bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-lg flex items-center gap-3">
                                <div className="w-10 h-10 bg-[rgba(59,130,246,0.15)] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck size={20} className="text-[#3B82F6]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-[#3B82F6] uppercase tracking-wide mb-0.5">Protected</div>
                                    <div className="text-[11px] text-[#888888] font-medium">LocalStorage Active</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-[#1A1A1F] border border-white/10 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center">
                                        <Bell size={20} className="text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-white uppercase tracking-wide">Deploy Alert</span>
                                </div>
                                <button onClick={() => setShowModal(null)} className="text-[#888888] hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6">
                                {/* Alert Type */}
                                <div className="space-y-3">
                                    <label className="text-[10px] text-[#888888] uppercase font-semibold tracking-wide block">Alert Type</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['price', 'resolution', 'time'] as AlertType[]).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setAlertType(type)}
                                                className={`py-3 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${alertType === type
                                                    ? 'bg-[#FF8C42]/10 border-[#FF8C42] text-[#FF8C42]'
                                                    : 'bg-white/5 border-white/10 text-[#666666] hover:border-white/20'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {alertType === 'price' && (
                                    <>
                                        <div className="space-y-3">
                                            <label className="text-[10px] text-[#888888] uppercase font-semibold tracking-wide block">Token Side</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {['YES', 'NO'].map(side => (
                                                    <button
                                                        key={side}
                                                        onClick={() => setTokenSide(side as 'YES' | 'NO')}
                                                        className={`py-3 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-all ${tokenSide === side
                                                            ? side === 'YES'
                                                                ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                                                                : 'bg-[#EF4444]/15 border-[#EF4444] text-[#EF4444]'
                                                            : 'bg-white/5 border-white/10 text-[#666666] hover:border-white/20'
                                                            }`}
                                                    >
                                                        {side}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] text-[#888888] uppercase font-semibold tracking-wide block">Target Price</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={targetPrice}
                                                onChange={(e) => setTargetPrice(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-center text-lg font-mono focus:outline-none focus:border-[#FF8C42] focus:shadow-[0_0_0_4px_rgba(255,140,66,0.1)] transition-all"
                                            />
                                        </div>
                                    </>
                                )}

                                {alertType === 'time' && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-[#888888] uppercase font-semibold tracking-wide block">Hours Before</label>
                                        <input
                                            type="number"
                                            value={hoursBefore}
                                            onChange={(e) => setHoursBefore(e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-center text-lg font-mono focus:outline-none focus:border-[#FF8C42] focus:shadow-[0_0_0_4px_rgba(255,140,66,0.1)] transition-all"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={addAlert}
                                    className="w-full py-4 bg-gradient-to-r from-[#FF8C42] to-[#FF7B2F] text-white rounded-xl text-sm font-bold uppercase tracking-wide shadow-[0_4px_16px_rgba(255,140,66,0.3)] hover:shadow-[0_8px_24px_rgba(255,140,66,0.4)] hover:scale-[1.02] transition-all active:scale-95"
                                >
                                    Confirm Deployment
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
