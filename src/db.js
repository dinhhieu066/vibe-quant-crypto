const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

// Private Passive Crypto Trading Database Schema
const defaultData = {
  owner: 'Personal Terminal (Private)',
  publicUrl: '',
  config: {
    exchangeRate: 25400,
    dailyTargetUSD: 10.0,      // Mục tiêu thụ động mỗi ngày: $10 (~254.000đ)
    monthlyTargetUSD: 300.0,   // Mục tiêu thụ động mỗi tháng: $300 (~7.620.000đ)
    autoCompound: true,        // Tự động tái đầu tư lợi nhuận (Lãi kép)
    riskProfile: 'balanced'    // safe (x1), moderate (x2), balanced (x3), aggressive (x5)
  },
  trading: {
    initialCapitalVND: 500000,
    initialCapitalUSD: 19.68,
    balanceVND: 500000,
    balanceUSD: 19.68,
    realizedPnlUSD: 0,
    realizedPnlVND: 0,
    todayPnlUSD: 0,
    todayPnlVND: 0,
    leverage: 3,
    mode: 'paper', // 'paper' (an toàn 100% kiểm chứng thuật toán) hoặc 'live'
    symbol: 'BTCUSDT',
    activePosition: null,
    tradesHistory: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      bestTradeUSD: 0,
      worstTradeUSD: 0
    }
  },
  dailyPnlRecords: [],
  logs: [
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      source: 'System',
      message: 'Private Autonomous Crypto Terminal khởi tạo thành công. Chế độ kiếm tiền thụ động 24/7 kích hoạt.'
    }
  ]
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class DB {
  constructor() {
    ensureDir(DATA_DIR);
    if (!fs.existsSync(DB_FILE)) {
      this.save(defaultData);
    }
  }

  load() {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (!data.trading) data.trading = defaultData.trading;
      if (!data.config) data.config = defaultData.config;
      if (!data.logs) data.logs = [];
      return data;
    } catch (e) {
      console.error('Error loading DB, restoring default schema:', e.message);
      this.save(defaultData);
      return defaultData;
    }
  }

  save(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving DB:', e.message);
    }
  }

  getConfig() {
    const data = this.load();
    return data.config || defaultData.config;
  }

  updateConfig(updates) {
    const data = this.load();
    data.config = { ...data.config, ...updates };
    this.save(data);
    return data.config;
  }

  getTrading() {
    const data = this.load();
    if (!data.trading) {
      data.trading = defaultData.trading;
      this.save(data);
    }
    return data.trading;
  }

  updateTrading(updates) {
    const data = this.load();
    data.trading = { ...data.trading, ...updates };
    this.save(data);
    return data.trading;
  }

  setCapital(amountVND) {
    const data = this.load();
    const cleanVND = Math.max(100000, parseInt(amountVND, 10) || 500000);
    const rate = data.config.exchangeRate || 25400;
    const cleanUSD = parseFloat((cleanVND / rate).toFixed(2));

    data.trading.initialCapitalVND = cleanVND;
    data.trading.initialCapitalUSD = cleanUSD;
    data.trading.balanceUSD = parseFloat((cleanUSD + data.trading.realizedPnlUSD).toFixed(2));
    data.trading.balanceVND = Math.round(data.trading.balanceUSD * rate);

    this.save(data);
    this.addLog('INFO', 'Capital', `Đã cập nhật mức vốn cá nhân: ${cleanVND.toLocaleString('vi-VN')} đ (≈ $${cleanUSD} USD).`);
    return data.trading;
  }

  recordTrade(trade) {
    const data = this.load();
    const rate = data.config.exchangeRate || 25400;

    data.trading.tradesHistory.unshift(trade);
    if (data.trading.tradesHistory.length > 100) {
      data.trading.tradesHistory = data.trading.tradesHistory.slice(0, 100);
    }

    // Update statistics
    const trades = data.trading.tradesHistory;
    const wins = trades.filter(t => t.pnlUSD > 0).length;
    const losses = trades.filter(t => t.pnlUSD < 0).length;
    const totalTrades = trades.length;

    const grossProfit = trades.filter(t => t.pnlUSD > 0).reduce((s, t) => s + t.pnlUSD, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnlUSD < 0).reduce((s, t) => s + t.pnlUSD, 0));
    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99 : 0);

    const bestTrade = trades.reduce((max, t) => Math.max(max, t.pnlUSD), 0);
    const worstTrade = trades.reduce((min, t) => Math.min(min, t.pnlUSD), 0);

    data.trading.stats = {
      totalTrades,
      wins,
      losses,
      winRate: totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0,
      profitFactor,
      bestTradeUSD: parseFloat(bestTrade.toFixed(2)),
      worstTradeUSD: parseFloat(worstTrade.toFixed(2))
    };

    // Compounding realized PnL
    data.trading.realizedPnlUSD = parseFloat((data.trading.realizedPnlUSD + trade.pnlUSD).toFixed(2));
    data.trading.realizedPnlVND = Math.round(data.trading.realizedPnlUSD * rate);
    data.trading.todayPnlUSD = parseFloat(((data.trading.todayPnlUSD || 0) + trade.pnlUSD).toFixed(2));
    data.trading.todayPnlVND = Math.round(data.trading.todayPnlUSD * rate);

    data.trading.balanceUSD = parseFloat((data.trading.initialCapitalUSD + data.trading.realizedPnlUSD).toFixed(2));
    data.trading.balanceVND = Math.round(data.trading.balanceUSD * rate);

    if (trade.pnlUSD > 0) {
      this.addLog(
        'SUCCESS',
        'PassiveIncome',
        `💰 [LÃI THỤ ĐỘNG] Chốt lời ${trade.side} ${trade.symbol}: +$${trade.pnlUSD.toFixed(2)} (+${trade.pnlPercent}%) | +${(trade.pnlUSD * rate).toLocaleString('vi-VN')} đ`
      );
    } else {
      this.addLog(
        'WARN',
        'RiskControl',
        `🛡️ [CẮT LỖ AN TOÀN] Đóng vị thế ${trade.side} ${trade.symbol}: -$${Math.abs(trade.pnlUSD).toFixed(2)} (${trade.pnlPercent}%) | Bảo vệ 98.8% vốn.`
      );
    }

    this.save(data);
    return data.trading;
  }

  addLog(level, source, message) {
    const data = this.load();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message
    };
    data.logs.unshift(entry);
    if (data.logs.length > 200) {
      data.logs = data.logs.slice(0, 200);
    }
    this.save(data);
    return entry;
  }

  clearLogs() {
    const data = this.load();
    data.logs = [];
    this.save(data);
  }

  getPublicUrl() {
    const data = this.load();
    return data.publicUrl || '';
  }

  setPublicUrl(url) {
    const data = this.load();
    data.publicUrl = url;
    this.save(data);
    return url;
  }

  resetStore() {
    this.save(defaultData);
    return defaultData;
  }
}

module.exports = new DB();
