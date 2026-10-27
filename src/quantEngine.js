const WebSocket = require('ws');
const db = require('./db');

// Multi-coin Watchlist: High liquidity, diverse volatility
const WATCHLIST = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
  { symbol: 'SOLUSDT', name: 'Solana', icon: '◎' },
  { symbol: 'BNBUSDT', name: 'BNB', icon: '🔶' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', icon: 'Ð' },
  { symbol: 'XRPUSDT', name: 'Ripple', icon: '✕' },
  { symbol: 'SUIUSDT', name: 'Sui Network', icon: '💧' },
  { symbol: 'LINKUSDT', name: 'Chainlink', icon: '⬡' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', icon: 'Ⓝ' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', icon: '🔺' }
];

class QuantEngine {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn || (() => {});
    this.ws = null;
    this.marketData = {}; // keyed by symbol: { price, change24h, high, low, volume, rsi, signal, opportunityScore, setupType }
    this.candles = {}; // symbol -> array of 1m closes
    this.reconnectTimer = null;
    this.scanInterval = null;
    this.isAutoTrading = true;
    this.lastSignalTime = 0;
    this.lastScanLogTime = 0;

    // Initialize marketData map
    WATCHLIST.forEach(item => {
      this.marketData[item.symbol] = {
        symbol: item.symbol,
        name: item.name,
        icon: item.icon,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume: 0,
        rsi: 50,
        signal: 'NEUTRAL',
        opportunityScore: 50,
        setupType: 'Rà soát tín hiệu...',
        lastUpdated: Date.now()
      };
      this.candles[item.symbol] = [];
    });
  }

  async start() {
    console.log('[QuantEngine] Initializing Multi-Coin Market Radar & Autonomous Quant Engine...');
    await this.preloadInitialData();
    this.connectMultiStream();

    // Autonomous Radar Scan every 8 seconds
    this.scanInterval = setInterval(() => this.autonomousRadarScan(), 8000);
  }

  async preloadInitialData() {
    try {
      console.log('[QuantEngine] Preloading initial 24h ticker prices from Binance REST API...');
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const allTickers = await res.json();

      if (Array.isArray(allTickers)) {
        allTickers.forEach(t => {
          if (this.marketData[t.symbol]) {
            const price = parseFloat(t.lastPrice);
            const chg = parseFloat(t.priceChangePercent);
            this.marketData[t.symbol].price = price;
            this.marketData[t.symbol].change24h = chg;
            this.marketData[t.symbol].high24h = parseFloat(t.highPrice);
            this.marketData[t.symbol].low24h = parseFloat(t.lowPrice);
            this.marketData[t.symbol].volume = Math.round(parseFloat(t.quoteVolume));
            this.computeCoinOpportunity(t.symbol);
          }
        });
        db.addLog('SUCCESS', 'QuantRadar', `Đã nạp dữ liệu 10 đồng coin top Binance (BTC, ETH, SOL, BNB, DOGE, XRP, SUI, LINK, NEAR, AVAX).`);
      }
    } catch (err) {
      console.error('[QuantEngine] Failed to preload tickers:', err.message);
    }
  }

  connectMultiStream() {
    if (this.ws) {
      try { this.ws.terminate(); } catch {}
    }

    // Connect to multi-stream of all watchlist coins
    const streamNames = WATCHLIST.map(w => `${w.symbol.toLowerCase()}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[QuantEngine] Multi-Stream WebSocket Connected to Binance for 10 assets!');
      db.addLog('SUCCESS', 'QuantEngine', 'Kết nối thành công luồng WebSocket 10 Coin trực tiếp từ Binance.');
    });

    this.ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.stream && msg.data) {
          this.handleTickerUpdate(msg.data);
        }
      } catch (e) {
        console.error('[QuantEngine] Multi-stream parse error:', e.message);
      }
    });

    this.ws.on('error', err => {
      console.error('[QuantEngine] WebSocket error:', err.message);
    });

    this.ws.on('close', () => {
      console.warn('[QuantEngine] Multi-stream closed, reconnecting in 3s...');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connectMultiStream(), 3000);
    });
  }

  handleTickerUpdate(t) {
    const symbol = t.s;
    if (!this.marketData[symbol]) return;

    const price = parseFloat(t.c);
    const chg = parseFloat(t.P);
    const high = parseFloat(t.h);
    const low = parseFloat(t.l);
    const vol = Math.round(parseFloat(t.q));

    const item = this.marketData[symbol];
    item.price = price;
    item.change24h = chg;
    item.high24h = high;
    item.low24h = low;
    item.volume = vol;
    item.lastUpdated = Date.now();

    // Maintain recent close price queue for RSI approximation
    if (!this.candles[symbol]) this.candles[symbol] = [];
    this.candles[symbol].push(price);
    if (this.candles[symbol].length > 30) {
      this.candles[symbol].shift();
    }

    this.computeCoinOpportunity(symbol);

    // If active position is in this symbol, evaluate live PnL and TP/SL
    const trading = db.getTrading();
    if (trading.activePosition && trading.activePosition.symbol === symbol) {
      this.evaluateActivePosition(price);
    }

    // Broadcast multi-tick periodically
    this.broadcastTick();
  }

  computeCoinOpportunity(symbol) {
    const item = this.marketData[symbol];
    const prices = this.candles[symbol] || [];

    // 1. Calculate RSI
    let rsi = 50;
    if (prices.length >= 14) {
      let gains = 0, losses = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14 === 0 ? 0.0001 : losses / 14;
      rsi = Math.round(100 - (100 / (1 + (avgGain / avgLoss))));
    } else {
      // Estimate RSI from 24h change if candle queue is still filling
      rsi = Math.min(85, Math.max(15, Math.round(50 + item.change24h * 3)));
    }
    item.rsi = rsi;

    // 2. Score opportunity & Determine setup
    // High score for extreme oversold (RSI < 35) -> Strong LONG potential
    // High score for extreme overbought (RSI > 68) -> Strong SHORT potential
    // High score for strong momentum breakout with volume
    let score = 50;
    let setup = 'Đang theo dõi biến động...';
    let signal = 'NEUTRAL';

    if (rsi <= 32) {
      score = 92 + Math.floor(Math.random() * 5);
      setup = '🔥 Siêu Quá Bán (Oversold Rebound)';
      signal = 'STRONG_BUY';
    } else if (rsi <= 40) {
      score = 80 + Math.floor(Math.random() * 6);
      setup = '⚡ Vùng Mua Hồi Phục (Dip Buy)';
      signal = 'BUY';
    } else if (rsi >= 72) {
      score = 90 + Math.floor(Math.random() * 6);
      setup = '🔻 Siêu Quá Mua (Overbought Pullback)';
      signal = 'STRONG_SELL';
    } else if (rsi >= 64) {
      score = 78 + Math.floor(Math.random() * 6);
      setup = '⚡ Vùng Bán Điều Chỉnh (Pullback Short)';
      signal = 'SELL';
    } else if (Math.abs(item.change24h) > 6.0) {
      score = 75 + Math.floor(Math.random() * 6);
      setup = item.change24h > 0 ? '🚀 Sóng Đẩy Momentum' : '⚠️ Áp Lực Xả Mạnh';
      signal = item.change24h > 0 ? 'BUY' : 'SELL';
    }

    item.opportunityScore = score;
    item.setupType = setup;
    item.signal = signal;
  }

  evaluateActivePosition(currentPrice) {
    const trading = db.getTrading();
    const pos = trading.activePosition;
    if (!pos || !currentPrice) return;

    const diff = pos.side === 'LONG'
      ? (currentPrice - pos.entryPrice)
      : (pos.entryPrice - currentPrice);

    const pricePercentChange = (diff / pos.entryPrice);
    pos.unrealizedPnlUSD = parseFloat((pricePercentChange * pos.sizeUSD).toFixed(3));
    pos.unrealizedPnlPercent = parseFloat(((pos.unrealizedPnlUSD / pos.marginUSD) * 100).toFixed(2));
    pos.currentPrice = currentPrice;

    // Smart Trailing Breakeven Stop-loss: if profit >= +1.0%, move SL to entry price
    if (pos.unrealizedPnlPercent >= 1.0 && !pos.isBreakevenProtected) {
      pos.isBreakevenProtected = true;
      pos.stopLoss = pos.entryPrice;
      db.updateTrading({ activePosition: pos });
      db.addLog(
        'SUCCESS',
        'QuantAI',
        `🛡️ [BẢO VỆ VỐN] Vị thế ${pos.side} ${pos.symbol} đạt lãi +${pos.unrealizedPnlPercent}%. Tự động dời Stop-Loss về giá hòa vốn ($${pos.entryPrice})!`
      );
    }

    // Check Take Profit
    if (
      (pos.side === 'LONG' && currentPrice >= pos.takeProfit) ||
      (pos.side === 'SHORT' && currentPrice <= pos.takeProfit)
    ) {
      this.closePosition('TAKE_PROFIT');
      return;
    }

    // Check Stop Loss
    if (
      (pos.side === 'LONG' && currentPrice <= pos.stopLoss) ||
      (pos.side === 'SHORT' && currentPrice >= pos.stopLoss)
    ) {
      this.closePosition(pos.isBreakevenProtected ? 'BREAKEVEN_EXIT' : 'STOP_LOSS');
      return;
    }

    db.updateTrading({ activePosition: pos });
  }

  autonomousRadarScan() {
    if (!this.isAutoTrading) return;
    const trading = db.getTrading();
    const now = Date.now();

    // If position is currently open, let evaluateActivePosition manage it
    if (trading.activePosition) return;

    // Cooldown 60s between auto entries
    if (now - this.lastSignalTime < 60000) return;

    // Find the coin with the highest opportunity score in the entire market!
    const candidates = Object.values(this.marketData).filter(c => c.price > 0);
    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.opportunityScore - a.opportunityScore);
    const bestCoin = candidates[0];

    // Periodic telemetry log for user
    if (now - this.lastScanLogTime > 45000) {
      this.lastScanLogTime = now;
      db.addLog(
        'INFO',
        'QuantRadar',
        `[Multi-Radar Scan] Đã quét 10 coin: Điểm tiềm năng cao nhất thuộc về ${bestCoin.symbol} (Score: ${bestCoin.opportunityScore}/100, RSI: ${bestCoin.rsi}, Setup: ${bestCoin.setupType}).`
      );
    }

    // Auto-execution threshold: Opportunity Score >= 78/100
    if (bestCoin.opportunityScore >= 78) {
      const side = (bestCoin.signal === 'STRONG_BUY' || bestCoin.signal === 'BUY') ? 'LONG' : 'SHORT';
      this.lastSignalTime = now;
      this.openPosition(bestCoin.symbol, side, `AI Radar: Điểm tiềm năng ${bestCoin.opportunityScore}/100 [${bestCoin.setupType}]`);
    }
  }

  openPosition(symbol, side, reason = 'Auto AI Multi-Coin Scanner') {
    const trading = db.getTrading();
    if (trading.activePosition) {
      return { success: false, error: 'Đang có một vị thế mở. Hãy đóng vị thế cũ trước.' };
    }

    const coinData = this.marketData[symbol];
    const currentPrice = coinData ? coinData.price : 0;
    if (!currentPrice) {
      return { success: false, error: `Chưa có giá thời gian thực cho ${symbol}` };
    }

    const leverage = trading.leverage || 3;
    const marginUSD = parseFloat((trading.balanceUSD * 0.25).toFixed(2));
    const sizeUSD = parseFloat((marginUSD * leverage).toFixed(2));

    const slDistance = currentPrice * 0.012;
    const tpDistance = currentPrice * 0.022;

    const stopLoss = side === 'LONG'
      ? parseFloat((currentPrice - slDistance).toFixed(currentPrice < 1 ? 4 : 2))
      : parseFloat((currentPrice + slDistance).toFixed(currentPrice < 1 ? 4 : 2));

    const takeProfit = side === 'LONG'
      ? parseFloat((currentPrice + tpDistance).toFixed(currentPrice < 1 ? 4 : 2))
      : parseFloat((currentPrice - tpDistance).toFixed(currentPrice < 1 ? 4 : 2));

    const position = {
      id: `POS-${Date.now().toString().slice(-4)}`,
      symbol,
      name: coinData.name || symbol,
      icon: coinData.icon || '🪙',
      side,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      marginUSD,
      sizeUSD,
      leverage,
      stopLoss,
      takeProfit,
      unrealizedPnlUSD: 0,
      unrealizedPnlPercent: 0,
      isBreakevenProtected: false,
      reason,
      openTime: new Date().toISOString()
    };

    db.updateTrading({ activePosition: position });
    db.addLog(
      'INFO',
      'QuantAI',
      `⚡ [TỰ ĐỘNG LÊN LỆNH ${side}] ${coinData.icon} ${symbol} @ $${currentPrice.toLocaleString('en-US')}. Đòn bẩy x${leverage}, Ký quỹ $${marginUSD} (Size $${sizeUSD}). SL: $${stopLoss}, TP: $${takeProfit} (${reason})`
    );

    this.broadcast({
      type: 'POSITION_OPENED',
      data: position
    });

    return { success: true, position };
  }

  closePosition(reason = 'MANUAL') {
    const trading = db.getTrading();
    const pos = trading.activePosition;
    if (!pos) {
      return { success: false, error: 'Không có vị thế nào đang mở.' };
    }

    const coinData = this.marketData[pos.symbol] || { price: pos.currentPrice };
    const currentPrice = coinData.price || pos.currentPrice;

    const diff = pos.side === 'LONG'
      ? (currentPrice - pos.entryPrice)
      : (pos.entryPrice - currentPrice);

    const pnlUSD = parseFloat(((diff / pos.entryPrice) * pos.sizeUSD).toFixed(3));
    const pnlPercent = parseFloat(((pnlUSD / pos.marginUSD) * 100).toFixed(2));

    let displayReason = reason;
    if (reason === 'TAKE_PROFIT') displayReason = 'Chốt lời tự động (Take Profit)';
    else if (reason === 'STOP_LOSS') displayReason = 'Cắt lỗ an toàn (Stop Loss)';
    else if (reason === 'BREAKEVEN_EXIT') displayReason = 'Bảo toàn hòa vốn (Breakeven Exit)';
    else if (reason === 'MANUAL_PANIC_CLOSE') displayReason = 'Đóng khẩn cấp thủ công';

    const trade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      closePrice: currentPrice,
      marginUSD: pos.marginUSD,
      sizeUSD: pos.sizeUSD,
      leverage: pos.leverage,
      pnlUSD,
      pnlPercent,
      closeReason: displayReason,
      openTime: pos.openTime,
      closeTime: new Date().toISOString()
    };

    db.updateTrading({ activePosition: null });
    const updatedTrading = db.recordTrade(trade);

    this.broadcast({
      type: 'POSITION_CLOSED',
      data: { trade, stats: updatedTrading.stats, balanceUSD: updatedTrading.balanceUSD }
    });

    return { success: true, trade };
  }

  broadcastTick() {
    const trading = db.getTrading();
    this.broadcast({
      type: 'RADAR_TICK',
      data: {
        marketRadar: Object.values(this.marketData),
        activePosition: trading.activePosition,
        balanceUSD: trading.balanceUSD,
        balanceVND: trading.balanceVND,
        realizedPnlUSD: trading.realizedPnlUSD,
        stats: trading.stats
      }
    });
  }

  setCapital(vndAmount) {
    const updated = db.setCapital(vndAmount);
    this.broadcast({
      type: 'CAPITAL_UPDATED',
      data: updated
    });
  }

  setLeverage(leverage) {
    const lev = Math.min(10, Math.max(1, parseInt(leverage, 10) || 3));
    const updated = db.updateTrading({ leverage: lev });
    db.addLog('INFO', 'RiskControl', `Đã điều chỉnh đòn bẩy giao dịch cá nhân: x${lev}`);
    this.broadcast({
      type: 'LEVERAGE_UPDATED',
      data: { leverage: lev }
    });
    return updated;
  }
}

module.exports = QuantEngine;
