
import { Market, StrategyConfig, Trade, BacktestResult, Candle, BaselineCurve } from '../types';

export const runBacktest = (market: Market, config: StrategyConfig, initialWallet: number): BacktestResult => {
  const candles = market.candles;
  let wallet = initialWallet;
  let position = 0; 
  let entryPrice = 0;
  const trades: Trade[] = [];
  const equityCurve: { timestamp: number; equity: number }[] = [];
  const events: { timestamp: number; type: string; intensity: number }[] = [];
  let maxEquity = initialWallet;
  let maxDrawdown = 0;

  const applySlippage = (price: number, type: 'BUY' | 'SELL') => {
    const factor = config.slippage || 0;
    return type === 'BUY' ? price * (1 + factor) : price * (1 - factor);
  };

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = i > 0 ? candles[i - 1] : null;

    // Detect Events (Abnormal volume or price jumps)
    if (candle.volume > 8000) {
      events.push({ timestamp: candle.timestamp, type: 'VOLUME_SPIKE', intensity: candle.volume / 15000 });
    }
    if (prevCandle && Math.abs(candle.close - prevCandle.close) > 0.05) {
      events.push({ timestamp: candle.timestamp, type: 'PRICE_JUMP', intensity: Math.abs(candle.close - prevCandle.close) * 10 });
    }

    // Strategy Logic
    switch (config.type) {
      case 'EARLY_ENTRY': {
        const entryIndex = Math.min(config.params.entryIndex || 5, candles.length - 1);
        if (i === entryIndex && position === 0) {
          const price = applySlippage(candle.close, 'BUY');
          position = Math.floor(wallet / price);
          wallet -= position * price;
          entryPrice = price;
          trades.push({ type: 'BUY', price, amount: position, timestamp: candle.timestamp, label: 'Early Entry', reason: 'Fixed delay reached' });
        }
        break;
      }
      case 'VOLUME_FADE': {
        const threshold = config.params.volumeThreshold || 7000;
        if (candle.volume > threshold && position === 0 && prevCandle) {
          const priceChange = candle.close - prevCandle.close;
          if (priceChange < -0.05) {
            const price = applySlippage(candle.close, 'BUY');
            position = Math.floor(wallet / price);
            wallet -= position * price;
            entryPrice = price;
            trades.push({ type: 'BUY', price, amount: position, timestamp: candle.timestamp, label: 'Vol Fade', reason: 'High volume panic detected' });
          }
        }
        if (position > 0 && i > (trades[trades.length-1].timestamp - candles[0].timestamp)/60000 + 15) {
            const price = applySlippage(candle.close, 'SELL');
            wallet += position * price;
            const pnl = (price - entryPrice) * position;
            trades.push({ type: 'SELL', price, amount: position, timestamp: candle.timestamp, pnl, label: 'Exit', reason: 'Mean reversion window closed' });
            position = 0;
        }
        break;
      }
      case 'MARKET_MAKING': {
        const spread = config.params.spreadWidth || 0.04;
        const buyLimit = candle.close - (spread / 2);
        const sellLimit = candle.close + (spread / 2);
        if (position === 0 && candle.low <= buyLimit) {
          const price = applySlippage(buyLimit, 'BUY');
          position = Math.floor(wallet / price);
          wallet -= position * price;
          entryPrice = price;
          trades.push({ type: 'BUY', price, amount: position, timestamp: candle.timestamp, label: 'Maker', reason: 'Limit order filled' });
        } else if (position > 0 && candle.high >= sellLimit) {
          const price = applySlippage(sellLimit, 'SELL');
          wallet += position * price;
          const pnl = (price - entryPrice) * position;
          trades.push({ type: 'SELL', price, amount: position, timestamp: candle.timestamp, pnl, label: 'Maker', reason: 'Limit offer taken' });
          position = 0;
        }
        break;
      }
      case 'STOP_LOSS_NEAR_RES': {
          const sl = config.params.stopLoss || 0.05;
          if (i === 0 && position === 0) {
              const price = applySlippage(candle.close, 'BUY');
              position = Math.floor(wallet / price);
              wallet -= position * price;
              entryPrice = price;
              trades.push({ type: 'BUY', price, amount: position, timestamp: candle.timestamp, label: 'Open', reason: 'Initial entry' });
          }
          if (position > 0 && candle.close < entryPrice * (1 - sl)) {
              const price = applySlippage(candle.close, 'SELL');
              wallet += position * price;
              const pnl = (price - entryPrice) * position;
              trades.push({ type: 'SELL', price, amount: position, timestamp: candle.timestamp, pnl, label: 'SL Hit', reason: 'Adverse movement limit breached' });
              position = 0;
          }
          break;
      }
    }

    const currentEquity = wallet + (position * candle.close);
    equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });
    maxEquity = Math.max(maxEquity, currentEquity);
    maxDrawdown = Math.max(maxDrawdown, (maxEquity - currentEquity) / maxEquity);
  }

  if (position > 0) {
    const last = candles[candles.length - 1];
    const price = applySlippage(last.close, 'SELL');
    wallet += position * price;
    trades.push({ type: 'SELL', price, amount: position, timestamp: last.timestamp, pnl: (price - entryPrice) * position, label: 'Reso', reason: 'Market resolution' });
  }

  // Baseline 1: Buy & Hold YES
  const bhCurve: { timestamp: number; equity: number }[] = [];
  let bhWallet = initialWallet;
  const bhEntry = candles[0].close;
  const bhPos = Math.floor(bhWallet / bhEntry);
  bhWallet -= bhPos * bhEntry;
  candles.forEach(c => bhCurve.push({ timestamp: c.timestamp, equity: bhWallet + (bhPos * c.close) }));

  // Baseline 2: Random Entry (Simplified for MVP, single run)
  const randCurve: { timestamp: number; equity: number }[] = [];
  let rWallet = initialWallet;
  let rPos = 0;
  const rEntryIndex = Math.floor(Math.random() * (candles.length / 2));
  candles.forEach((c, i) => {
    if (i === rEntryIndex) {
      rPos = Math.floor(rWallet / c.close);
      rWallet -= rPos * c.close;
    }
    randCurve.push({ timestamp: c.timestamp, equity: rWallet + (rPos * c.close) });
  });

  return {
    totalPnL: wallet - initialWallet,
    returnPercentage: ((wallet - initialWallet) / initialWallet) * 100,
    maxDrawdown: maxDrawdown * 100,
    winRate: (trades.filter(t => t.type === 'SELL' && (t.pnl || 0) > 0).length / trades.filter(t => t.type === 'SELL').length || 0) * 100,
    trades,
    equityCurve,
    events,
    baselines: [
      { name: 'Buy & Hold', data: bhCurve, color: '#52525b' },
      { name: 'Random Mean', data: randCurve, color: '#3f3f46' }
    ]
  };
};
