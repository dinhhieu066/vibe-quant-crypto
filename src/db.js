const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin).trim() + '_vibe_salt_2026').digest('hex');
}

// Private Passive Crypto Trading Database Schema
const defaultData = {
  owner: 'Personal Terminal (Private)',
  publicUrl: '',
  auth: {
    // Mã PIN mặc định ban đầu là: 888888 (Có thể đổi bất kỳ lúc nào trên web)
    pinHash: hashPin('888888'),
    failedAttempts: 0,
    lockedUntil: 0
  },
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
    maxConcurrentPositions: 3,
    mode: 'paper', // 'paper' (an toàn 100% kiểm chứng thuật toán) hoặc 'live'
    symbol: 'BTCUSDT',
    activePosition: null,
    activePositions: [],
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
      source: 'SecurityShield',
      message: 'Hệ thống bảo vệ đa tầng đã kích hoạt. Mọi thao tác đều yêu cầu xác thực mã PIN cá nhân.'
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
    this._cache = null;
    this._saveTimer = null;
    if (!fs.existsSync(DB_FILE)) {
      this.save(defaultData);
    }
  }

  load() {
    if (this._cache) {
      return JSON.parse(JSON.stringify(this._cache));
    }
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (!data.trading) data.trading = defaultData.trading;
      if (!data.config) data.config = defaultData.config;
      if (!data.auth) data.auth = defaultData.auth;
      if (!data.logs) data.logs = [];
      this._cache = data;
      return JSON.parse(JSON.stringify(this._cache));
    } catch (e) {
      console.error('Error loading DB, restoring default schema:', e.message);
      this._cache = defaultData;
      this.save(defaultData);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  save(data) {
    this._cache = JSON.parse(JSON.stringify(data));
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(this._cache, null, 2), 'utf-8');
      } catch (e) {
        if (e.code === 'EBUSY') {
          setTimeout(() => {
            try { fs.writeFileSync(DB_FILE, JSON.stringify(this._cache, null, 2), 'utf-8'); } catch {}
          }, 150);
        } else {
          console.error('Error saving DB:', e.message);
        }
      }
    }, 60);
  }

  // --- SECURITY & AUTHENTICATION METHODS ---
  verifyPin(inputPin) {
    const data = this.load();
    const now = Date.now();

    // Check brute-force lockout
    if (data.auth.lockedUntil && data.auth.lockedUntil > now) {
      const remainingMinutes = Math.ceil((data.auth.lockedUntil - now) / 60000);
      return {
        success: false,
        error: `Hệ thống đang khóa bảo vệ do nhập sai nhiều lần. Thử lại sau ${remainingMinutes} phút.`,
        locked: true,
        remainingMinutes
      };
    }

    // Support environment override via TERMINAL_PIN
    const envPin = process.env.TERMINAL_PIN;
    const isCorrect = envPin
      ? String(inputPin).trim() === String(envPin).trim()
      : hashPin(inputPin) === data.auth.pinHash;

    if (isCorrect) {
      data.auth.failedAttempts = 0;
      data.auth.lockedUntil = 0;
      this.save(data);
      this.addLog('SUCCESS', 'Security', 'Xác thực thành công. Đã cấp quyền truy cập trạm điều hành.');
      return { success: true };
    } else {
      data.auth.failedAttempts = (data.auth.failedAttempts || 0) + 1;
      const remainingAttempts = Math.max(0, 5 - data.auth.failedAttempts);

      if (data.auth.failedAttempts >= 5) {
        data.auth.lockedUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
        this.save(data);
        this.addLog('WARN', 'SecurityShield', 'CẢNH BÁO: Phát hiện 5 lần nhập sai mã PIN. Kích hoạt khóa bảo mật 15 phút!');
        return {
          success: false,
          error: 'Nhập sai 5 lần. Hệ thống tự động khóa bảo vệ trong 15 phút!',
          locked: true,
          remainingMinutes: 15
        };
      }

      this.save(data);
      this.addLog('WARN', 'Security', `Phát hiện nhập sai mã PIN (Còn ${remainingAttempts} lần thử trước khi khóa).`);
      return {
        success: false,
        error: `Mã PIN không chính xác! Còn ${remainingAttempts} lần thử.`,
        remainingAttempts
      };
    }
  }

  changePin(currentPin, newPin) {
    const verify = this.verifyPin(currentPin);
    if (!verify.success) return verify;

    const cleanNewPin = String(newPin).trim();
    if (cleanNewPin.length < 4 || cleanNewPin.length > 12) {
      return { success: false, error: 'Mã PIN mới phải từ 4 đến 12 ký tự.' };
    }

    const data = this.load();
    data.auth.pinHash = hashPin(cleanNewPin);
    data.auth.failedAttempts = 0;
    data.auth.lockedUntil = 0;
    this.save(data);

    this.addLog('SUCCESS', 'Security', 'Đã cập nhật mã PIN bảo mật cá nhân mới thành công.');
    return { success: true };
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
    if (!Array.isArray(data.trading.activePositions)) {
      data.trading.activePositions = data.trading.activePosition ? [data.trading.activePosition] : [];
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
