import { HelpCircle, Activity, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { isAPIKeyConfigured } from '../services/opinionApiClient';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoError, setLogoError] = useState(false);


  return (
    <div className="flex flex-col h-screen bg-[#060608] text-[#F8F8F8] overflow-hidden font-sans">
      {/* Top Navigation - Floating Glass Header */}
      <div className="px-6 pt-4 pb-0 relative z-50">
        <header className="glass-surface-elevated flex items-center justify-between h-14 px-5 rounded-xl border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Sub-surface glow effect */}
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-orange-500/5 to-transparent pointer-events-none" />

          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#FF6100] flex items-center justify-center rounded-lg shadow-[0_0_20px_rgba(255,97,0,0.4)] relative overflow-hidden">
                {!logoError ? (
                  <img
                    src="/logo/logo.png"
                    alt="Logo"
                    className="w-full h-full object-cover"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <>
                    <Activity size={18} className="text-black font-bold" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-black rounded-full flex items-center justify-center border border-white/10">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-widest uppercase leading-none shimer-text">
                  Opinion <span className="text-[#FF6100]">Replay</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-mono font-semibold tracking-[0.2em] uppercase mt-0.5">
                  Institutional Terminal v1.0
                </span>
              </div>
            </div>

            {/* Nav Links Removed per User Request */}
          </div>

          {/* Right Section: System Status */}
          <div className="flex items-center gap-5">
            <div className={`flex items-center gap-3 px-3 py-1.5 bg-black/40 border rounded-lg transition-colors ${isAPIKeyConfigured() ? 'border-[#00FF9C]/20' : 'border-[#FF3E5E]/20'}`}>
              <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
                {isAPIKeyConfigured() ? (
                  <Wifi size={12} className="text-[#00FF9C]" />
                ) : (
                  <WifiOff size={12} className="text-[#FF3E5E]" />
                )}
                <span className={`text-[10px] font-mono font-bold ${isAPIKeyConfigured() ? 'text-[#00FF9C]' : 'text-[#FF3E5E]'}`}>
                  {isAPIKeyConfigured() ? 'LIVE' : 'DEMO'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`status-dot ${isAPIKeyConfigured() ? 'status-dot-active' : 'bg-[#FF3E5E] shadow-[0_0_8px_rgba(255,62,94,0.5)]'}`} />
                <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase">
                  {isAPIKeyConfigured() ? 'Network Ready' : 'Sandbox Mode'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-white/10 pl-5">
              <button className="p-1.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-zinc-400 hover:text-white">
                <HelpCircle size={16} />
              </button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-[10px] font-black font-mono shadow-xl text-zinc-400">
                QS
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Main Container - Space reserved for header padding */}
      <main className="flex-1 flex overflow-hidden mt-2 px-6 pb-6">
        <div className="w-full h-full glass-surface rounded-2xl border border-white/5 overflow-hidden flex">
          {children}
        </div>
      </main>
    </div>
  );
};
