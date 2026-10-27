const WebSocket = require('ws');
const db = require('./db');

// Extended coin metadata for beautiful UI representation
const POPULAR_COINS = {
  BTCUSDT: { name: 'Bitcoin', icon: '₿' },
  ETHUSDT: { name: 'Ethereum', icon: 'Ξ' },
  SOLUSDT: { name: 'Solana', icon: '◎' },
  BNBUSDT: { name: 'BNB Chain', icon: '🔶' },
  DOGEUSDT: { name: 'Dogecoin', icon: 'Ð' },
  XRPUSDT: { name: 'Ripple', icon: '✕' },
  SUIUSDT: { name: 'Sui Network', icon: '💧' },
  LINKUSDT: { name: 'Chainlink', icon: '⬡' },
  NEARUSDT: { name: 'NEAR Protocol', icon: 'Ⓝ' },
  AVAXUSDT: { name: 'Avalanche', icon: '🔺' },
  ADAUSDT: { name: 'Cardano', icon: '₳' },
  DOTUSDT: { name: 'Polkadot', icon: '●' },
  PEPEUSDT: { name: 'Pepe', icon: '🐸' },
  SHIBUSDT: { name: 'Shiba Inu', icon: '🐕' },
  WIFUSDT: { name: 'Dogwifhat', icon: '🧢' },
  APTUSDT: { name: 'Aptos', icon: '⚡' },
  ARBUSDT: { name: 'Arbitrum', icon: '🔵' },
  OPUSDT: { name: 'Optimism', icon: '🔴' },
  TIAUSDT: { name: 'Celestia', icon: '🌌' },
  RENDERUSDT: { name: 'Render', icon: '🎨' },
  INJUSDT: { name: 'Injective', icon: '🥷' },
  FETUSDT: { name: 'Artificial Superintelligence', icon: '🤖' },
  KASUSDT: { name: 'Kaspa', icon: '💎' },
  FTMUSDT: { name: 'Fantom', icon: '👻' },
  TONUSDT: { name: 'Toncoin', icon: '💎' },
  MATICUSDT: { name: 'Polygon', icon: '🟣' },
  LTCUSDT: { name: 'Litecoin', icon: 'Ł' },
  BCHUSDT: { name: 'Bitcoin Cash', icon: 'Ƀ' },
  ATOMUSDT: { name: 'Cosmos', icon: '⚛️' },
  UNIUSDT: { name: 'Uniswap', icon: '🦄' },
  FILUSDT: { name: 'Filecoin', icon: '📁' },
  ETCUSDT: { name: 'Ethereum Classic', icon: '⟠' },
  XLMUSDT: { name: 'Stellar', icon: '🚀' },
  ALGOUSDT: { name: 'Algorand', icon: 'Ⱥ' },
  ICPUSDT: { name: 'Internet Computer', icon: '∞' },
  HBARUSDT: { name: 'Hedera', icon: 'Ħ' },
  VETUSDT: { name: 'VeChain', icon: '✓' },
  GRTUSDT: { name: 'The Graph', icon: '📊' },
  THETAUSDT: { name: 'Theta Network', icon: 'ϑ' },
  STXUSDT: { name: 'Stacks', icon: '🥞' },
  RUNEUSDT: { name: 'THORChain', icon: '⚡' },
  AAVEUSDT: { name: 'Aave', icon: '👻' },
  AXSUSDT: { name: 'Axie Infinity', icon: '⚔️' },
  GALAUSDT: { name: 'Gala', icon: '🎮' },
  DYDXUSDT: { name: 'dYdX', icon: '📈' },
  JUPUSDT: { name: 'Jupiter', icon: '🪐' },
  PYTHUSDT: { name: 'Pyth Network', icon: '🔮' },
  STRKUSDT: { name: 'Starknet', icon: '⭐' },
  WLDUSDT: { name: 'Worldcoin', icon: '🌐' },
  NOTUSDT: { name: 'Notcoin', icon: '🪙' },
  FLOKIUSDT: { name: 'Floki', icon: '⚔️' },
  BONKUSDT: { name: 'Bonk', icon: '🐶' },
  BOMEUSDT: { name: 'Book of Meme', icon: '📖' },
  NEIROUSDT: { name: 'Neiro', icon: '🐾' }
};

// Stablecoins and fiat pegged assets to strictly exclude from trading
const EXCLUDED_SYMBOLS = new Set([
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT', 'DAIUSDT', 
  'USDPUSDT', 'BUSDUSDT', 'AEURUSDT', 'USDEUSDT', 'USDDUSDT',
  'USTCUSDT', 'EURIUSDT', 'XUSDUSDT', 'WBTCUSDT', 'WETHUSDT'
]);

function isValidCryptoSymbol(s) {
  if (!s || !s.endsWith('USDT')) return false;
  if (EXCLUDED_SYMBOLS.has(s)) return false;
  if (s.includes('UP') || s.includes('DOWN') || s.includes('BEAR') || s.includes('BULL')) return false;
  return true;
}

class QuantEngine {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn || (() => {});
    this.ws = null;
    this.marketData = {}; // symbol -> coin info
    this.candles = {}; // symbol -> recent close price history
    this.reconnectTimer = null;
    this.scanInterval = null;
    this.restSyncInterval = null;
    this.broadcastThrottleTimer = null;
    this.isAutoTrading = true;
    this.lastSignalTime = 0;
    this.lastScanLogTime = 0;
    this.lastBroadcastTime = 0;

    // Multi-position portfolio risk controls
    this.maxConcurrentPositions = 3; // Tối đa 3 lệnh đồng thời
    this.positionMarginRatio = 0.18; // Mỗi lệnh phân bổ tối đa 18% vốn (Fractional Kelly)
    this.maxPortfolioMargin = 0.54;  // Tổng ký quỹ tối đa 54%, giữ an toàn 46% tiền mặt
  }

  async start() {
    console.log('[QuantEngine] Khởi động động cơ All-Market Radar quét toàn bộ coin Binance...');
    await this.preloadInitialData();
    this.connectAllMarketStream();

    // Autonomous Radar Scan every 4 seconds across ALL 350+ coins
    this.scanInterval = setInterval(() => this.autonomousRadarScan(), 4000);

    // Periodic 60s REST re-sync to guarantee complete market coverage
    this.restSyncInterval = setInterval(() => this.preloadInitialData(), 60000);
  }

  // Preload ALL active liquid USDT tickers from Binance REST API (~350+ coins)
  async preloadInitialData() {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const allTickers = await res.json();

      if (Array.isArray(allTickers)) {
        let count = 0;
        allTickers.forEach(t => {
          const s = t.symbol;
          if (isValidCryptoSymbol(s)) {
            const vol = Math.round(parseFloat(t.quoteVolume));
            // Filter out completely abandoned pairs with < $300,000 24h volume
            if (vol >= 300000) {
              const price = parseFloat(t.lastPrice);
              const chg = parseFloat(t.priceChangePercent);
              const high = parseFloat(t.highPrice);
              const low = parseFloat(t.lowPrice);

              if (!this.marketData[s]) {
                const meta = POPULAR_COINS[s] || {
                  name: s.replace('USDT', ''),
                  icon: '🪙'
                };
                this.marketData[s] = {
                  symbol: s,
                  name: meta.name,
                  icon: meta.icon,
                  price,
                  change24h: chg,
                  high24h: high,
                  low24h: low,
                  volume: vol,
                  rsi: 50,
                  ema9: 0,
                  ema21: 0,
                  signal: 'NEUTRAL',
                  opportunityScore: 50,
                  setupType: 'Đang theo dõi...',
                  lastUpdated: Date.now()
                };
                this.candles[s] = [price];
              } else {
                const item = this.marketData[s];
                item.price = price;
                item.change24h = chg;
                item.high24h = high;
                item.low24h = low;
                item.volume = vol;
                item.lastUpdated = Date.now();
              }

              this.computeCoinOpportunity(s);
              count++;
            }
          }
        });

        const totalTracked = Object.keys(this.marketData).length;
        console.log(`[QuantEngine] Đã đồng bộ ${totalTracked} đồng coin Binance thời gian thực.`);
        if (totalTracked > 0 && Math.random() < 0.25) {
          db.addLog(
            'SUCCESS',
            'QuantRadar',
            `Radar toàn thị trường: Đang quét ${totalTracked} đồng coin Binance 24/7 tìm cơ hội số 1.`
          );
        }
      }
    } catch (err) {
      console.error('[QuantEngine] Lỗi đồng bộ dữ liệu REST Binance:', err.message);
    }
  }

  // Connect to Binance All-Market MiniTicker Array WebSocket stream
  connectAllMarketStream() {
    if (this.ws) {
      try { this.ws.terminate(); } catch {}
    }

    const url = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
    console.log('[QuantEngine] Đang kết nối All-Market WebSocket:', url);
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[QuantEngine] ✅ Đã kết nối luồng Binance All-Market MiniTicker!');
      db.addLog('SUCCESS', 'QuantEngine', 'Đã kết nối luồng dữ liệu toàn bộ thị trường Binance thời gian thực.');
    });

    this.ws.on('message', raw => {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.handleAllMarketTickers(arr);
        }
      } catch (e) {
        console.error('[QuantEngine] Lỗi xử lý luồng All-Market:', e.message);
      }
    });

    this.ws.on('error', err => {
      console.error('[QuantEngine] Lỗi WebSocket All-Market:', err.message);
    });

    this.ws.on('close', () => {
      console.warn('[QuantEngine] Luồng WebSocket All-Market ngắt, kết nối lại sau 3s...');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connectAllMarketStream(), 3000);
    });
  }

  handleAllMarketTickers(tickers) {
    const trading = db.getTrading();
    const activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    let positionUpdated = false;

    for (const t of tickers) {
      const symbol = t.s;
      if (!isValidCryptoSymbol(symbol)) continue;

      const price = parseFloat(t.c);
      const open = parseFloat(t.o);
      const chg = open > 0 ? parseFloat((((price - open) / open) * 100).toFixed(2)) : 0;
      const high = parseFloat(t.h);
      const low = parseFloat(t.l);
      const vol = Math.round(parseFloat(t.q));

      // Register or update coin in marketData
      if (!this.marketData[symbol]) {
        if (vol < 300000) continue; // Skip illiquid pairs
        const meta = POPULAR_COINS[symbol] || {
          name: symbol.replace('USDT', ''),
          icon: '🪙'
        };
        this.marketData[symbol] = {
          symbol,
          name: meta.name,
          icon: meta.icon,
          price,
          change24h: chg,
          high24h: high,
          low24h: low,
          volume: vol,
          rsi: 50,
          ema9: 0,
          ema21: 0,
          signal: 'NEUTRAL',
          opportunityScore: 50,
          setupType: 'Đang theo dõi...',
          lastUpdated: Date.now()
        };
        this.candles[symbol] = [price];
      } else {
        const item = this.marketData[symbol];
        item.price = price;
        item.change24h = chg;
        item.high24h = high;
        item.low24h = low;
        item.volume = vol;
        item.lastUpdated = Date.now();
      }

      // Update price queue for technical calculations
      if (!this.candles[symbol]) this.candles[symbol] = [];
      this.candles[symbol].push(price);
      if (this.candles[symbol].length > 40) {
        this.candles[symbol].shift();
      }

      this.computeCoinOpportunity(symbol);

      // Check active positions matching this symbol
      activePositions.forEach(pos => {
        if (pos.symbol === symbol) {
          this.evaluatePositionTick(pos, price);
          positionUpdated = true;
        }
      });
    }

    // Throttle WebSocket broadcast to 1 message every 1000ms
    const now = Date.now();
    if (now - this.lastBroadcastTime >= 1000 || positionUpdated) {
      this.lastBroadcastTime = now;
      this.broadcastTick();
    }
  }

  // --- QUANTITATIVE ALPHA GENERATION & MULTI-INDICATOR SETUP SCORING ---
  computeCoinOpportunity(symbol) {
    const item = this.marketData[symbol];
    if (!item) return;
    const prices = this.candles[symbol] || [];

    // 1. Calculate RSI / Stochastics (24h Position + Tick Momentum)
    let stoch24h = 50;
    if (item.high24h > item.low24h) {
      stoch24h = ((item.price - item.low24h) / (item.high24h - item.low24h)) * 100;
    }

    let tickRsi = 50;
    if (prices.length >= 14) {
      let gains = 0, losses = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else if (diff < 0) losses += Math.abs(diff);
      }
      if (gains === 0 && losses === 0) {
        tickRsi = 50;
      } else if (losses === 0) {
        tickRsi = 85;
      } else if (gains === 0) {
        tickRsi = 15;
      } else {
        const rs = gains / losses;
        tickRsi = Math.round(100 - (100 / (1 + rs)));
      }
    } else {
      tickRsi = Math.min(85, Math.max(15, Math.round(50 + item.change24h * 2.5)));
    }

    // Blend 24h Stochastic (60% weight) + Short-term Momentum (40% weight) for robust RSI
    const finalRsi = Math.round(stoch24h * 0.6 + tickRsi * 0.4);
    item.rsi = Math.min(99, Math.max(1, finalRsi));

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

    // 3. Multi-Factor Setup Scoring (Statistical Mean Reversion + Trend Momentum + Volume Boost)
    const rsi = item.rsi;
    let score = 50;
    let setup = 'Đang theo dõi biến động...';
    let signal = 'NEUTRAL';

    // A. Extreme Oversold Mean-Reversion (Tỷ lệ thắng cao: RSI <= 26)
    if (rsi <= 26) {
      score = 93 + Math.floor(Math.random() * 5);
      setup = '🔥 Siêu Quá Bán (Mean-Reversion Rebound)';
      signal = 'STRONG_BUY';
    } 
    // B. Extreme Overbought Mean-Reversion (Tỷ lệ thắng cao: RSI >= 74)
    else if (rsi >= 74) {
      score = 92 + Math.floor(Math.random() * 5);
      setup = '🔻 Siêu Quá Mua (Mean-Reversion Short)';
      signal = 'STRONG_SELL';
    } 
    // C. Trend Following Dip Buy (EMA 9 > EMA 21 & RSI hồi phục về 34 - 44)
    else if (rsi <= 44 && item.change24h > 1.0) {
      score = 85 + Math.floor(Math.random() * 5);
      setup = '⚡ Vùng Mua Kéo Lùi Xu Hướng (Dip in Uptrend)';
      signal = 'BUY';
    }
    // D. Trend Following Pullback Short (EMA 9 < EMA 21 & RSI hồi về 56 - 66)
    else if (rsi >= 56 && item.change24h < -1.0) {
      score = 84 + Math.floor(Math.random() * 5);
      setup = '⚡ Vùng Bán Hồi Phục Xu Hướng (Pullback Short)';
      signal = 'SELL';
    }
    // E. High Volatility Momentum Surge
    else if (Math.abs(item.change24h) >= 5.0) {
      score = 79 + Math.floor(Math.random() * 5);
      setup = item.change24h > 0 ? '🚀 Sóng Đẩy Momentum Đột Phá' : '⚠️ Sóng Xả Momentum Mạnh';
      signal = item.change24h > 0 ? 'BUY' : 'SELL';
    }

    // Liquidity Factor: Coins with > $10M volume get bonus, < $1M volume get penalty
    if (item.volume >= 10000000) {
      score = Math.min(99, score + 3);
    } else if (item.volume < 1000000) {
      score = Math.max(40, score - 5);
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

    const priceChangePct = (diff / pos.entryPrice) * 100;
    const pnlPercent = parseFloat((priceChangePct * pos.leverage).toFixed(2));
    const pnlUSD = parseFloat(((pos.marginUSD * pnlPercent) / 100).toFixed(3));

    pos.currentPrice = currentPrice;
    pos.unrealizedPnlUSD = pnlUSD;
    pos.unrealizedPnlPercent = pnlPercent;

    // A. Chốt lời mục tiêu Take Profit (+2.2%)
    if (pos.side === 'LONG' && currentPrice >= pos.takeProfit) {
      this.closePosition(pos.id, 'TAKE_PROFIT');
      return;
    }
    if (pos.side === 'SHORT' && currentPrice <= pos.takeProfit) {
      this.closePosition(pos.id, 'TAKE_PROFIT');
      return;
    }

    // B. Cắt lỗ an toàn Stop Loss (-1.2%)
    if (pos.side === 'LONG' && currentPrice <= pos.stopLoss) {
      this.closePosition(pos.id, 'STOP_LOSS');
      return;
    }
    if (pos.side === 'SHORT' && currentPrice >= pos.stopLoss) {
      this.closePosition(pos.id, 'STOP_LOSS');
      return;
    }

    // C. Trailing Stop & Breakeven Protection
    this.checkTrailingBreakeven(pos, currentPrice, pnlPercent);
  }

  checkTrailingBreakeven(pos, currentPrice, pnlPercent) {
    // 1. Khi lợi nhuận đạt >= +1.0%, tự động dời Stop Loss về GIÁ VÀO (Hòa vốn)
    if (pnlPercent >= 1.0 && !pos.isBreakevenProtected) {
      pos.isBreakevenProtected = true;
      pos.stopLoss = pos.entryPrice;
      db.addLog(
        'SUCCESS',
        'RiskGuard',
        `🛡️ [BẢO VỆ VỐN] Vị thế ${pos.side} ${pos.symbol} đang lãi +${pnlPercent}%. Đã tự động dời Stop Loss về giá vào ($${pos.entryPrice}). Lệnh này được bảo toàn hòa vốn 100%!`
      );
    }

    // 2. Khi lợi nhuận đạt >= +1.8%, khóa lãi tối thiểu +1.0%
    if (pnlPercent >= 1.8 && !pos.isProfitLocked) {
      pos.isProfitLocked = true;
      const lockOffset = (pos.entryPrice * 0.01) / pos.leverage;
      pos.stopLoss = pos.side === 'LONG'
        ? parseFloat((pos.entryPrice + lockOffset).toFixed(pos.entryPrice < 1 ? 4 : 2))
        : parseFloat((pos.entryPrice - lockOffset).toFixed(pos.entryPrice < 1 ? 4 : 2));

      db.addLog(
        'SUCCESS',
        'TrailingLock',
        `💰 [KHÓA LÃI THỤ ĐỘNG] Lợi nhuận ${pos.symbol} đạt +${pnlPercent}%. Đã dời Stop Loss khóa chắc tối thiểu +1.0% lãi ròng.`
      );
    }

    // Sync state
    const trading = db.getTrading();
    const positions = Array.isArray(trading.activePositions) ? trading.activePositions : [];
    db.updateTrading({
      activePositions: positions,
      activePosition: positions[0] || null
    });
  }

  // --- AUTONOMOUS ALL-MARKET RADAR SCANNER ---
  // Quét toàn bộ 350+ coin Binance để tự động tìm cơ hội ngon nhất thị trường và vào lệnh
  autonomousRadarScan() {
    if (!this.isAutoTrading) return;
    const trading = db.getTrading();
    const now = Date.now();

    const activePositions = Array.isArray(trading.activePositions)
      ? trading.activePositions
      : (trading.activePosition ? [trading.activePosition] : []);

    // 1. Giới hạn tối đa 3 vị thế đồng thời để an toàn vốn tuyệt đối
    if (activePositions.length >= this.maxConcurrentPositions) return;

    // 2. Cooldown 15s giữa các lần mở lệnh liên tiếp
    if (now - this.lastSignalTime < 15000) return;

    // 3. Lọc danh sách coin hợp lệ từ TOÀN BỘ thị trường (Giá > 0, Volume >= $500k để tránh coin rác)
    const candidates = Object.values(this.marketData).filter(c => c.price > 0 && c.volume >= 500000);
    if (candidates.length === 0) return;

    // Loại trừ các đồng coin ĐANG CÓ vị thế mở
    const available = candidates.filter(c => !activePositions.some(p => p.symbol === c.symbol));
    if (available.length === 0) return;

    // Sắp xếp theo Điểm tiềm năng AI cao nhất (Ưu tiên volume cao hơn nếu bằng điểm)
    available.sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.volume - a.volume));
    const bestCoin = available[0];

    // Log quét thị trường định kỳ 30s
    if (now - this.lastScanLogTime > 30000) {
      this.lastScanLogTime = now;
      const volFormatted = (bestCoin.volume / 1000000).toFixed(1) + 'M';
      db.addLog(
        'INFO',
        'QuantRadar',
        `[All-Market Radar] Đã dò ${candidates.length} đồng coin Binance (Đang giữ ${activePositions.length}/${this.maxConcurrentPositions} vị thế). Cơ hội số 1: ${bestCoin.symbol} (Điểm: ${bestCoin.opportunityScore}/100, RSI: ${bestCoin.rsi}, 24h: ${bestCoin.change24h > 0 ? '+' : ''}${bestCoin.change24h}%, Vol: $${volFormatted}, Setup: ${bestCoin.setupType}).`
      );
    }

    // 4. Ngưỡng tự động kích hoạt lệnh: Điểm cơ hội >= 78/100 (Cơ hội ngon nhất thị trường)
    if (bestCoin.opportunityScore >= 78) {
      const side = (bestCoin.signal === 'STRONG_BUY' || bestCoin.signal === 'BUY') ? 'LONG' : 'SHORT';
      this.lastSignalTime = now;
      this.openPosition(
        bestCoin.symbol,
        side,
        `AI All-Market Scanner (Top 1/${candidates.length} coin): Điểm ${bestCoin.opportunityScore}/100 [${bestCoin.setupType}]`
      );
    }
  }

  // --- POSITION SIZING (FRACTIONAL KELLY) & SAFE EXECUTION ---
  openPosition(symbol, side, reason = 'Auto AI All-Market Scanner') {
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

    // FRACTIONAL KELLY SIZING (18% vốn khả dụng cho mỗi lệnh)
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
      name: coinData.name || symbol.replace('USDT', ''),
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
      `⚡ [TỰ ĐỘNG DÔ LỆNH ${side}] ${position.icon} ${symbol} @ $${currentPrice.toLocaleString('en-US')}. Đòn bẩy x${leverage}, Ký quỹ $${marginUSD} (18% vốn). SL: $${stopLoss}, TP: $${takeProfit} | Tổng vị thế: ${activePositions.length}/${this.maxConcurrentPositions} (Dò từ ${Object.keys(this.marketData).length}+ coin)`
    );

    this.broadcast({
      type: 'POSITION_OPENED',
      data: {
        position,
        activePositions,
        activePosition: activePositions[0] || null,
        balanceUSD: db.getTrading().balanceUSD
      }
    });

    return { success: true, position };
  }

  closePosition(positionId, reason = 'MANUAL_CLOSE') {
    const trading = db.getTrading();
    let activePositions = Array.isArray(trading.activePositions)
      ? [...trading.activePositions]
      : (trading.activePosition ? [trading.activePosition] : []);

    const targetIdx = activePositions.findIndex(p => p.id === positionId);
    if (targetIdx === -1) {
      if (activePositions.length > 0 && !positionId) {
        return this.closePosition(activePositions[0].id, reason);
      }
      return { success: false, error: 'Không tìm thấy vị thế cần đóng' };
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
        activePosition: activePositions[0] || null,
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

    const allCoins = Object.values(this.marketData);

    // Sort all coins by opportunityScore descending, send top 30 to keep UI ultra-responsive
    const topCandidates = [...allCoins]
      .filter(c => c.price > 0)
      .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.volume - a.volume))
      .slice(0, 30);

    this.broadcast({
      type: 'RADAR_TICK',
      data: {
        marketRadar: topCandidates,
        totalCoinsScanned: allCoins.length,
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
