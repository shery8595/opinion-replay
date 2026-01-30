
import React from 'react';
import { Market } from '../types';
import { Search, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import { getMarketImage } from '../utils/marketImages';

interface Props {
  markets: Market[];
  selectedMarket: Market;
  isLoading?: boolean;
  onSelect: (market: Market) => void;
}

export const MarketSelector: React.FC<Props> = ({ markets, selectedMarket, isLoading, onSelect }) => {
  return (
    <div className="w-60 border-r border-white/5 bg-black/20 p-3.5 flex flex-col gap-6 shrink-0 relative z-10 font-sans">
      <div className="space-y-6">
        {/* Precision Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#FF6100] transition-colors" size={14} />
          <input
            type="text"
            placeholder="SEARCH TERMINAL..."
            className="cyber-input w-full pl-9 pr-4 py-2.5 text-[10px] uppercase font-bold tracking-widest placeholder:text-zinc-700"
          />
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-data-header">
            <Database size={12} className="text-[#FF6100]" />
            Active Market Library
          </div>
          {isLoading && (
            <div className="w-3 h-3 border-2 border-[#FF6100]/30 border-t-[#FF6100] rounded-full animate-spin" />
          )}
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 custom-scrollbar">
          {isLoading ? (
            // Loading Skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-2 w-16 bg-white/5 rounded" />
                    <div className="h-4 w-32 bg-white/10 rounded" />
                  </div>
                  <div className="h-4 w-10 bg-white/5 rounded" />
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between">
                  <div className="h-2 w-12 bg-white/5 rounded" />
                  <div className="h-2 w-16 bg-white/5 rounded" />
                </div>
              </div>
            ))
          ) : markets.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-zinc-600 text-[10px] uppercase font-black tracking-widest leading-relaxed">
                Connect API to unlock<br />institutional feeds
              </div>
            </div>
          ) : (
            markets.map((m, index) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelect(m)}
                className={`w-full text-left p-3 rounded-xl transition-all relative overflow-hidden group border ${selectedMarket.id === m.id
                  ? 'bg-[#FF6100]/10 border-[#FF6100]/40 shadow-[0_0_20px_rgba(255,97,0,0.1)]'
                  : 'cyber-card border-white/5 hover:border-white/10'
                  }`}
              >
                {selectedMarket.id === m.id && (
                  <div className="selected-indicator" />
                )}

                <div className="flex gap-3 items-start mb-3">
                  {/* Market Image */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10">
                    <img
                      src={m.imageUrl || getMarketImage(m.topicId)}
                      alt={m.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://pub-d9508a69438c476b87530c53cfa2910c.r2.dev/shareImg.png';
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="text-[9px] font-mono font-black text-zinc-600 tracking-tighter">ID: {m.id.substring(0, 8)}</div>
                    <span className={`text-[11px] font-extrabold tracking-tight leading-4 line-clamp-2 ${selectedMarket.id === m.id ? 'text-[#FF6100]' : 'text-zinc-200 group-hover:text-white'}`}>
                      {m.name}
                    </span>
                  </div>

                  <div className={`text-[8px] px-1.5 py-0.5 rounded-sm font-black tracking-widest border shrink-0 ${m.outcome === 'YES'
                    ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20'
                    : 'bg-rose-500/5 text-rose-500 border-rose-500/20'
                    }`}>
                    {m.outcome}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${m.qualityScore > 80 ? 'bg-emerald-500' : 'bg-amber-500'} shadow-[0_0_8px_currentColor]`} />
                    <span className={`text-[10px] font-mono font-bold tracking-tighter ${m.qualityScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      Q:{m.qualityScore}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    <span className="text-[10px] font-mono font-bold">{m.candles.length}</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter">TICKS</span>
                  </div>
                </div>

                {/* Hover Glow */}
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
