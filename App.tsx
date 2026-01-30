import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from './components/Layout';
import { MarketSelector } from './components/MarketSelector';
import { MarketAnalytics } from './components/MarketAnalytics';
import { ResolutionSimulator } from './components/ResolutionSimulator';
import { MarketReminder } from './components/MarketReminder';
import { MarketTimeMachine } from './components/MarketTimeMachine';
import { MOCK_MARKETS, DEFAULT_MARKET_LIMIT } from './constants';
import { Market } from './types';
import { fetchResolvedMarkets, isAPIKeyConfigured } from './services/opinionApiClient';
import { transformOpinionMarket } from './services/dataTransformer';
import {
  RotateCcw, TrendingUp,
  Activity, AlertTriangle, ShieldAlert
} from 'lucide-react';

const App: React.FC = () => {
  // Data source management
  const [dataSource, setDataSource] = useState<'MOCK' | 'REAL'>('REAL');
  const [markets, setMarkets] = useState<Market[]>([]); // Start empty for REAL
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [activeTab, setActiveTab] = useState<'BACKTEST' | 'REMINDER' | 'XRAY' | 'SIMULATOR'>('BACKTEST');

  // Mobile State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load markets based on data source
  useEffect(() => {
    loadMarkets();
  }, [dataSource]);


  const loadMarkets = async () => {
    if (dataSource === 'MOCK') {
      setMarkets(MOCK_MARKETS);
      setSelectedMarket(MOCK_MARKETS[0]);
      setLoadError(null);
      return;
    }

    // Check if API key is configured
    if (!isAPIKeyConfigured()) {
      setLoadError('API key not configured. Please set VITE_OPINION_API_KEY in .env.local');
      setMarkets(MOCK_MARKETS);
      setDataSource('MOCK');
      return;
    }

    setIsLoadingMarkets(true);
    setLoadError(null);

    try {
      console.log('Fetching activated markets from Opinion API...');
      const opinionMarkets = await fetchResolvedMarkets(DEFAULT_MARKET_LIMIT);

      console.log(`Loaded ${opinionMarkets.length} markets. Transforming...`);
      console.log('Market IDs:', opinionMarkets.map(m => m.marketId));

      // Transform markets without fetching history for all of them upfront
      // This prevents hitting 429 rate limits on large market lists
      const transformedMarkets = opinionMarkets
        .filter(om => om.yesTokenId) // Ensure we have at least a YES token
        .map(om => transformOpinionMarket(om, []));

      if (transformedMarkets.length === 0) {
        throw new Error('No valid markets loaded from Opinion API');
      }

      setMarkets(transformedMarkets);
      setSelectedMarket(transformedMarkets[0]);
      console.log(`Successfully loaded ${transformedMarkets.length} markets`);

    } catch (error) {
      console.error('Failed to load markets from Opinion:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setLoadError(`Failed to load markets: ${errorMsg}`);

      // Fallback to mock data
      setMarkets(MOCK_MARKETS);
      setSelectedMarket(MOCK_MARKETS[0]);
      setDataSource('MOCK');
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  return (
    <Layout onMobileMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
      <AnimatePresence>
        {loadError && (
          <div className="bg-black/40 border-b border-white/5 px-6 py-3 flex items-center justify-between pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-[#FF3E5E] text-[10px] font-bold uppercase tracking-tighter bg-[#FF3E5E]/10 px-3 py-1 rounded-full border border-[#FF3E5E]/20 pointer-events-auto shadow-lg"
            >
              <AlertTriangle size={12} />
              <span>{loadError}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Navigation Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 bottom-0 left-0 w-[280px] z-50 md:hidden bg-[#0A0A0F] border-r border-white/10 shadow-2xl overflow-y-auto"
            >
              <MarketSelector
                markets={markets}
                selectedMarket={selectedMarket}
                isLoading={isLoadingMarkets}
                onSelect={(m) => {
                  setSelectedMarket(m);
                  setIsMobileMenuOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col border-r border-white/5 bg-black/20 relative z-10 w-60">
        {!['XRAY', 'REMINDER'].includes(activeTab) && (
          <MarketSelector
            markets={markets}
            selectedMarket={selectedMarket}
            isLoading={isLoadingMarkets}
            onSelect={(m) => {
              setSelectedMarket(m);
            }}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Charts Column */}
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto custom-scrollbar">
            {/* Scrollable Tab Navigation for Mobile */}
            <div className="w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
              <div className="flex items-center gap-2 mb-4 bg-[#0C0C0E]/80 p-2 rounded-2xl border border-white/10 w-fit backdrop-blur-sm shadow-2xl min-w-max">
                <button
                  onClick={() => setActiveTab('BACKTEST')}
                  className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest px-4 md:px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'BACKTEST' ? 'bg-gradient-to-r from-[#FF6100] to-[#FF8C00] text-black shadow-[0_4px_20px_rgba(255,97,0,0.4)] scale-105' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  <RotateCcw size={14} className={activeTab === 'BACKTEST' ? 'text-black' : ''} />
                  Time Machine
                </button>
                <button
                  onClick={() => setActiveTab('REMINDER')}
                  className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest px-4 md:px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'REMINDER' ? 'bg-gradient-to-r from-[#FF6100] to-[#FF8C00] text-black shadow-[0_4px_20px_rgba(255,97,0,0.4)] scale-105' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  <AlertTriangle size={14} className={activeTab === 'REMINDER' ? 'text-black' : ''} />
                  Reminders
                </button>
                <button
                  onClick={() => setActiveTab('XRAY')}
                  className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest px-4 md:px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'XRAY' ? 'bg-gradient-to-r from-[#FF6100] to-[#FF8C00] text-black shadow-[0_4px_20px_rgba(255,97,0,0.4)] scale-105' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Activity size={14} className={activeTab === 'XRAY' ? 'text-black' : ''} />
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab('SIMULATOR')}
                  className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest px-4 md:px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'SIMULATOR' ? 'bg-gradient-to-r from-[#FF6100] to-[#FF8C00] text-black shadow-[0_4px_20px_rgba(255,97,0,0.4)] scale-105' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  <TrendingUp size={14} className={activeTab === 'SIMULATOR' ? 'text-black' : ''} />
                  PnL Simulator
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'BACKTEST' && (
                <motion.div
                  key="backtest"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 flex flex-col"
                >
                  <MarketTimeMachine market={selectedMarket} />
                </motion.div>
              )}

              {/* Market Reminder Tab */}
              {activeTab === 'REMINDER' && (
                <motion.div
                  key="reminder"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1"
                >
                  <MarketReminder />
                </motion.div>
              )}

              {/* Market Analytics Tab */}
              {activeTab === 'XRAY' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1"
                >
                  <MarketAnalytics />
                </motion.div>
              )}

              {/* Resolution Simulator Tab */}
              {activeTab === 'SIMULATOR' && (
                <motion.div
                  key="simulator"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1"
                >
                  <ResolutionSimulator market={selectedMarket} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar - Local Sandboxed Insights */}
          {activeTab === 'BACKTEST' && (
            <div className="hidden lg:flex w-80 border-l border-white/5 bg-black/40 flex-col p-7 space-y-10 overflow-y-auto custom-scrollbar relative z-10 font-sans">
              <section className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-500 uppercase font-black text-[9px] tracking-[0.3em]">
                  <RotateCcw size={14} className="text-[#FF6100]" />
                  Internal Sandbox
                </div>
                <div className="p-5 rounded-2xl bg-[#FF6100]/5 border border-[#FF6100]/20 space-y-3 shadow-[0_0_30px_rgba(255,97,0,0.05)]">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={12} className="text-[#FF6100]" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">Temporal Isolation</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-bold tracking-tight">
                    Protocol is executing in historical simulation mode. No external market exposure detected.
                  </p>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-500 uppercase font-black text-[9px] tracking-[0.3em]">
                  <TrendingUp size={14} className="text-[#FF6100]" />
                  Engine Feed
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Signal Engine', value: 'Heuristic-v4', color: '#00FF9C' },
                    { label: 'Sandbox State', value: 'Synchronized', color: '#00E0FF' },
                    { label: 'Neural Layer', value: 'Active', color: '#00FF9C' },
                    { label: 'Frame Consistency', value: 'Verified', color: '#00FF9C' }
                  ].map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                      <span className="text-[9px] font-black text-zinc-600 uppercase group-hover:text-zinc-400 transition-colors">{stat.label}</span>
                      <span className="text-[10px] font-mono font-black" style={{ color: stat.color }}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-auto pt-6 border-t border-white/10">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={12} className="text-[#FF6100]" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase">System Integrity</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#00FF9C] h-full w-[98%] shadow-[0_0_10px_#00FF9C]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;
