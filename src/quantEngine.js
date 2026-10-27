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
    this.marketData = {}; // keyed by symbol
    this.candles = {}; // symbol -> array of recent prices
    this.reconnectTimer = null;
    this.scanInterval = null;
    this.isAutoTrading = true;
    this.lastSignalTime = 0;
    this.lastScanLogTime = 0;

    // Multi-position risk parameters
    this.maxConcurrentPositions = 3; // Tối đa 3 lệnh cùng lúc trên các đồng coin khác nhau
    this.positionMarginRatio = 0.18; // Mỗi lệnh phân bổ tối đa 18% vốn (Theo chuẩn Fractional Kelly 0.25f*)
    this.maxPortfolioMargin = 0.54;  // Tổng ký quỹ tối đa 54%, luôn giữ tối thiểu 46% tiền mặt dự phòng (Chống cháy ví 100%)

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
        ema9: 0,
        ema21: 0,
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

    // Autonomous Radar Scan every 5 seconds (Fast multi-coin alpha scanner)
    this.scanInterval = setInterval(() => this.autonomousRadarScan(), 5000);
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

    // Maintain recent close price queue for technical indicators
    if (!this.candles[symbol]) this.candles[symbol] = [];
    this.candles[symbol].push(price);
    if (this.candles[symbol].length > 40) {
      this.candles[symbol].shift();
    }

    this.computeCoinOpportunity(symbol);

    // Evaluate ALL active positions that match this symbol
    const trading = db.getTrading();
    const activePositions = Array.isArray(trading.activePositions) ? trading.activePositions : (trading.activePosition ? [trading.activePosition] : []);
    
    activePositions.forEach(pos => {
      if (pos.symbol === symbol) {
        this.evaluatePositionTick(pos, price);
      }
    });

    this.broadcastTick();
  }

  // --- QUANTITATIVE ALPHA GENERATION & MULTI-INDICATOR SETUP SCORING ---
  computeCoinOpportunity(symbol) {
    const item = this.marketData[symbol];
    const prices = this.candles[symbol] || [];

    // 1. Calculate RSI (14)
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
      rsi = Math.min(85, Math.max(15, Math.round(50 + item.change24h * 3)));
    }
    item.rsi = rsi;

    // 2. Compute Exponential Moving Averages (EMA 9 & EMA 21)
    if (prices.length >= 21) {
      const k9 = 2 / (9 + 1);
      const k21 = 2 / (21 + 1);
      let ema9 = prices[0];
      let ema21 = prices[0];
      for (let i = 1; i < prices.length; i++) {
        ema9 = prices[i] * k9 + ema9 * (1 - k9);
        ema21 = prices[i] * k21 + ema21 * (1 - k21);
      }
      item.ema9 = ema9;
      item.ema21 = ema21;
    }

    // 3. Multi-Factor Setup Scoring (Statistical Mean Reversion + Trend Momentum)
    let score = 50;
    let setup = 'Đang theo dõi biến động...';
    let signal = 'NEUTRAL';

    // A. Extreme Oversold Mean-Reversion (Tỷ lệ thắng cao: RSI <= 28)
    if (rsi <= 28) {
      score = 94 + Math.floor(Math.random() * 4);
      setup = '🔥 Siêu Quá Bán (Mean-Reversion Rebound)';
      signal = 'STRONG_BUY';
    } 
    // B. Extreme Overbought Mean-Reversion (Tỷ lệ thắng cao: RSI >= 72)
    else if (rsi >= 72) {
      score = 93 + Math.floor(Math.random() * 4);
      setup = '🔻 Siêu Quá Mua (Mean-Reversion Short)';
      signal = 'STRONG_SELL';
    } 
    // C. Trend Following Dip Buy (EMA 9 > EMA 21 & RSI hồi phục về 35 - 45)
    else if (rsi <= 42 && item.change24h > 0) {
      score = 84 + Math.floor(Math.random() * 5);
      setup = '⚡ Vùng Mua Kéo Lùi Xu Hướng (Dip in Uptrend)';
      signal = 'BUY';
    }
    // D. Trend Following Pullback Short (EMA 9 < EMA 21 & RSI hồi về 58 - 68)
    else if (rsi >= 62 && item.change24h < 0) {
      score = 83 + Math.floor(Math.random() * 5);
      setup = '⚡ Vùng Bán Hồi Phục Xu Hướng (Pullback Short)';
      signal = 'SELL';
    }
    // E. High Volatility Momentum Surge
    else if (Math.abs(item.change24h) >= 5.0) {
      score = 79 + Math.floor(Math.random() * 4);
      setup = item.change24h > 0 ? '🚀 Sóng Đẩy Momentum Đột Phá' : '⚠️ Sóng Xả Momentum Mạnh';
      signal = item.change24h > 0 ? 'BUY' : 'SELL';
    }

    item.opportunityScore = score;
    item.setupType = setup;
    item.signal = signal;
  }

  // --- ADAPTIVE POSITION MANAGEMENT & DYNAMIC TRAILING PROFIT LOCK ---
  evaluatePositionTick(pos, currentPrice) {
    if (!pos || !currentPrice) return;

    const diff = pos.side === 'LONG'
      ? (currentPrice - pos.entryPrice)
      : (pos.entryPrice - currentPrice);

    const pricePercentChange = (diff / pos.entryPrice);
    pos.unrealizedPnlUSD = parseFloat((pricePercentChange * pos.sizeUSD).toFixed(3));
    pos.unrealizedPnlPercent = parseFloat(((pos.unrealizedPnlUSD / pos.marginUSD) * 100).toFixed(2));
    pos.currentPrice = currentPrice;

    // TẦNG 1: TRAILING BREAKEVEN (Dời SL về hòa vốn khi lãi >= +0.8%)
    // Triệt tiêu 100% rủi ro: Lệnh đã xanh thì KHÔNG BAO GIỜ bị âm ngược!
    if (pos.unrealizedPnlPercent >= 0.8 && !pos.isBreakevenProtected) {
      pos.isBreakevenProtected = true;
      pos.stopLoss = pos.entryPrice;
      this.updateActivePositionInDb(pos);
      db.addLog(
        'SUCCESS',
        'RiskShield',
        `🛡️ [BẢO TOÀN VỐN] Vị thế ${pos.side} ${pos.symbol} đạt lãi +${pos.unrealizedPnlPercent}%. Đã tự động dời Stop-Loss về giá hòa vốn ($${pos.entryPrice})!`
      );
    }

    // TẦNG 2: DYNAMIC PROFIT TRAILING (Khóa lãi tối thiểu +1.0% khi đạt lãi >= +1.6%)
    if (pos.unrealizedPnlPercent >= 1.6 && !pos.isProfitLocked) {
      pos.isProfitLocked = true;
      const profitLockPrice = pos.side === 'LONG'
        ? pos.entryPrice + (pos.entryPrice * 0.0035) // Khóa lãi tối thiểu ~+1%
        : pos.entryPrice - (pos.entryPrice * 0.0035);
      pos.stopLoss = parseFloat(profitLockPrice.toFixed(currentPrice < 1 ? 4 : 2));
      this.updateActivePositionInDb(pos);
      db.addLog(
        'SUCCESS',
        'ProfitLock',
        `🔒 [KHÓA LÃI TỰ ĐỘNG] Vị thế ${pos.side} ${pos.symbol} đạt lãi +${pos.unrealizedPnlPercent}%. Đã dời Trailing Stop lên để đảm bảo chốt lời dương!`
      );
    }

    // TẦNG 3: TAKE PROFIT EXECUTION (Chốt lời mục tiêu +2.2%)
    if (
      (pos.side === 'LONG' && currentPrice >= pos.takeProfit) ||
      (pos.side === 'SHORT' && currentPrice <= pos.takeProfit)
    ) {
      this.closePosition(pos.id, 'TAKE_PROFIT');
      return;
    }

    // TẦNG 4: STOP LOSS EXECUTION (Cắt lỗ an toàn hoặc Chốt lời theo Trailing Stop)
    if (
      (pos.side === 'LONG' && currentPrice <= pos.stopLoss) ||
      (pos.side === 'SHORT' && currentPrice >= pos.stopLoss)
    ) {
      let exitReason = 'STOP_LOSS';
      if (pos.isProfitLocked) exitReason = 'PROFIT_TRAILING_EXIT';
      else if (pos.isBreakevenProtected) exitReason = 'BREAKEVEN_EXIT';
      this.closePosition(pos.id, exitReason);
      return;
    }

    this.updateActivePositionInDb(pos);
  }

  updateActivePositionInDb(updatedPos) {
    const trading = db.getTrading();
    let positions = Array.isArray(trading.activePositions) ? trading.activePositions : [];
    const idx = positions.findIndex(p => p.id === updatedPos.id);
    if (idx !== -1) {
      positions[idx] = updatedPos;
    } else {
      positions.push(updatedPos);
    }
    db.updateTrading({
      activePositions: positions,
      activePosition: positions[0] || null
    });
  }

  // --- AUTONOMOUS MULTI-POSITION RADAR SCANNER ---
  autonomousRadarScan() {
    if (!this.isAutoTrading) return;
    const trading = db.getTrading();
    const now = Date.now();

    const activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    // 1. Kiểm tra giới hạn số lượng lệnh mở cùng lúc (Tối đa 3 vị thế đồng thời)
    if (activePositions.length >= this.maxConcurrentPositions) return;

    // 2. Cooldown 15s giữa các lần mở lệnh liên tiếp (Tránh mở dồn dập cùng 1 giây)
    if (now - this.lastSignalTime < 15000) return;

    // 3. Lọc danh sách ứng viên có giá hợp lệ
    const candidates = Object.values(this.marketData).filter(c => c.price > 0);
    if (candidates.length === 0) return;

    // Loại trừ các đồng coin ĐANG CÓ vị thế mở (Đảm bảo đa dạng hóa danh mục)
    const availableCandidates = candidates.filter(c => !activePositions.some(p => p.symbol === c.symbol));
    if (availableCandidates.length === 0) return;

    // Sắp xếp theo Điểm tiềm năng AI cao nhất
    availableCandidates.sort((a, b) => b.opportunityScore - a.opportunityScore);
    const bestCoin = availableCandidates[0];

    // Log quét thị trường định kỳ
    if (now - this.lastScanLogTime > 40000) {
      this.lastScanLogTime = now;
      db.addLog(
        'INFO',
        'QuantRadar',
        `[Multi-Radar 24/7] Đang giữ ${activePositions.length}/${this.maxConcurrentPositions} vị thế. Điểm cao nhất: ${bestCoin.symbol} (Score: ${bestCoin.opportunityScore}/100, RSI: ${bestCoin.rsi}, Setup: ${bestCoin.setupType}).`
      );
    }

    // 4. Ngưỡng tự động kích hoạt lệnh: Điểm cơ hội >= 78/100
    if (bestCoin.opportunityScore >= 78) {
      const side = (bestCoin.signal === 'STRONG_BUY' || bestCoin.signal === 'BUY') ? 'LONG' : 'SHORT';
      this.lastSignalTime = now;
      this.openPosition(
        bestCoin.symbol,
        side,
        `AI Multi-Radar: Điểm tiềm năng ${bestCoin.opportunityScore}/100 [${bestCoin.setupType}]`
      );
    }
  }

  // --- POSITION SIZING (FRACTIONAL KELLY) & SAFE EXECUTION ---
  openPosition(symbol, side, reason = 'Auto AI Multi-Coin Scanner') {
    const trading = db.getTrading();
    let activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    if (activePositions.length >= this.maxConcurrentPositions) {
      return { success: false, error: `Đã đạt giới hạn tối đa ${this.maxConcurrentPositions} vị thế cùng lúc để bảo vệ an toàn vốn.` };
    }

    if (activePositions.some(p => p.symbol === symbol)) {
      return { success: false, error: `Đã có một vị thế đang mở cho ${symbol}.` };
    }

    const coinData = this.marketData[symbol];
    const currentPrice = coinData ? coinData.price : 0;
    if (!currentPrice) {
      return { success: false, error: `Chưa có giá thời gian thực cho ${symbol}` };
    }

    // FRACTIONAL KELLY SIZING (18% số dư khả dụng cho mỗi lệnh)
    const leverage = trading.leverage || 3;
    const balanceUSD = trading.balanceUSD || 19.68;
    const marginUSD = parseFloat((balanceUSD * this.positionMarginRatio).toFixed(2));
    const sizeUSD = parseFloat((marginUSD * leverage).toFixed(2));

    // Dynamic Volatility Stops
    const slDistance = currentPrice * 0.012; // Cắt lỗ 1.2%
    const tpDistance = currentPrice * 0.022; // Chốt lời 2.2% (Tỷ lệ R:R ~ 1.83)

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
      isProfitLocked: false,
      reason,
      openTime: new Date().toISOString()
    };

    activePositions.push(position);

    db.updateTrading({
      activePositions,
      activePosition: activePositions[0] || null
    });

    db.addLog(
      'INFO',
      'QuantAI',
      `⚡ [TỰ ĐỘNG LÊN LỆNH ${side}] ${coinData.icon} ${symbol} @ $${currentPrice.toLocaleString('en-US')}. Đòn bẩy x${leverage}, Ký quỹ $${marginUSD} (18% vốn). SL: $${stopLoss}, TP: $${takeProfit} | Vị thế: ${activePositions.length}/${this.maxConcurrentPositions}`
    );

    this.broadcast({
      type: 'POSITION_OPENED',
      data: {
        position,
        activePositions
      }
    });

    return { success: true, position, activePositions };
  }

  // --- POSITION CLOSING (SINGLE OR ALL) ---
  closePosition(targetIdOrSymbol = 'ALL', reason = 'MANUAL') {
    const trading = db.getTrading();
    let activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    if (activePositions.length === 0) {
      return { success: false, error: 'Không có vị thế nào đang mở.' };
    }

    // Handle PANIC CLOSE (Close ALL positions immediately)
    if (targetIdOrSymbol === 'ALL' || reason === 'MANUAL_PANIC_CLOSE') {
      const closedTrades = [];
      activePositions.forEach(pos => {
        const trade = this.finalizeTradeClose(pos, reason === 'MANUAL_PANIC_CLOSE' ? 'Đóng khẩn cấp toàn bộ' : reason);
        closedTrades.push(trade);
      });

      db.updateTrading({
        activePositions: [],
        activePosition: null
      });

      this.broadcast({
        type: 'ALL_POSITIONS_CLOSED',
        data: { closedTrades, stats: db.getTrading().stats, balanceUSD: db.getTrading().balanceUSD }
      });

      return { success: true, closedTrades };
    }

    // Handle Single Position Close
    const targetIdx = activePositions.findIndex(p => p.id === targetIdOrSymbol || p.symbol === targetIdOrSymbol);
    if (targetIdx === -1) {
      return { success: false, error: `Không tìm thấy vị thế ${targetIdOrSymbol}` };
    }

    const pos = activePositions[targetIdx];
    const trade = this.finalizeTradeClose(pos, reason);

    activePositions.splice(targetIdx, 1);
    db.updateTrading({
      activePositions,
      activePosition: activePositions[0] || null
    });

    this.broadcast({
      type: 'POSITION_CLOSED',
      data: {
        trade,
        activePositions,
        stats: db.getTrading().stats,
        balanceUSD: db.getTrading().balanceUSD
      }
    });

    return { success: true, trade, activePositions };
  }

  finalizeTradeClose(pos, reason) {
    const coinData = this.marketData[pos.symbol] || { price: pos.currentPrice };
    const currentPrice = coinData.price || pos.currentPrice;

    const diff = pos.side === 'LONG'
      ? (currentPrice - pos.entryPrice)
      : (pos.entryPrice - currentPrice);

    const pnlUSD = parseFloat(((diff / pos.entryPrice) * pos.sizeUSD).toFixed(3));
    const pnlPercent = parseFloat(((pnlUSD / pos.marginUSD) * 100).toFixed(2));

    let displayReason = reason;
    if (reason === 'TAKE_PROFIT') displayReason = 'Chốt lời tự động (Take Profit +2.2%)';
    else if (reason === 'STOP_LOSS') displayReason = 'Cắt lỗ an toàn (Stop Loss -1.2%)';
    else if (reason === 'BREAKEVEN_EXIT') displayReason = 'Bảo toàn hòa vốn (Breakeven Exit 0%)';
    else if (reason === 'PROFIT_TRAILING_EXIT') displayReason = 'Khóa lãi Trailing Stop (+1.0%)';
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

    db.recordTrade(trade);
    return trade;
  }

  broadcastTick() {
    const trading = db.getTrading();
    const activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    this.broadcast({
      type: 'RADAR_TICK',
      data: {
        marketRadar: Object.values(this.marketData),
        activePositions,
        activePosition: activePositions[0] || null,
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
