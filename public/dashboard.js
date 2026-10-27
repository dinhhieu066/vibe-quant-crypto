// VibeQuant AI // Private Autonomous Crypto Passive Income Terminal Logic

let state = {
  publicUrl: '',
  isAutoTrading: true,
  marketRadar: [],
  config: {
    exchangeRate: 25400,
    dailyTargetUSD: 10.0,
    monthlyTargetUSD: 300.0,
    riskProfile: 'balanced'
  },
  trading: {
    initialCapitalUSD: 19.68,
    initialCapitalVND: 500000,
    balanceUSD: 19.68,
    balanceVND: 500000,
    realizedPnlUSD: 0,
    realizedPnlVND: 0,
    todayPnlUSD: 0,
    todayPnlVND: 0,
    leverage: 3,
    activePosition: null,
    tradesHistory: [],
    stats: { totalTrades: 0, wins: 0, losses: 0, winRate: 0 }
  },
  logs: []
};

let previousPrices = {};
let ws = null;
let currentPinBuffer = '';
let authToken = localStorage.getItem('vibe_auth_token') || '';

// DOM Elements - PIN Gate
const pinGate = document.getElementById('pin-gate');
const pinDotsWrap = document.getElementById('pin-dots');
const pinDots = document.querySelectorAll('.pin-dot');
const pinInputHidden = document.getElementById('pin-input-hidden');
const pinErrorMsg = document.getElementById('pin-error-msg');
const keyUnlock = document.getElementById('key-unlock');
const keyClear = document.getElementById('key-clear');
const btnLockTerminal = document.getElementById('btn-lock-terminal');

// DOM Elements - Header
const wsBadge = document.getElementById('ws-badge');
const statUptime = document.getElementById('stat-uptime');
const publicWebLink = document.getElementById('public-web-link');
const btnCopyPublicUrl = document.getElementById('btn-copy-public-url');
const toggleAutoTrading = document.getElementById('toggle-auto-trading');
const quantModeBadge = document.getElementById('quant-mode-badge');

// Capital Buttons
const btnCap500k = document.getElementById('btn-cap-500k');
const btnCap1000k = document.getElementById('btn-cap-1000k');
const btnCap2000k = document.getElementById('btn-cap-2000k');
const btnCap5000k = document.getElementById('btn-cap-5000k');

// Leverage Buttons
const btnLev1 = document.getElementById('btn-lev-1');
const btnLev2 = document.getElementById('btn-lev-2');
const btnLev3 = document.getElementById('btn-lev-3');
const btnLev5 = document.getElementById('btn-lev-5');
const levDisplay = document.getElementById('lev-display');

// Performance Cards
const tradeBalanceVnd = document.getElementById('trade-balance-vnd');
const tradeBalanceUsd = document.getElementById('trade-balance-usd');
const tradePnlUsd = document.getElementById('trade-pnl-usd');
const tradePnlVnd = document.getElementById('trade-pnl-vnd');
const tradeCounts = document.getElementById('trade-counts');

// Daily Goal Elements
const goalTargetLabel = document.getElementById('goal-target-label');
const goalProgressFill = document.getElementById('goal-progress-fill');
const goalProgressPct = document.getElementById('goal-progress-pct');
const goalProgressRem = document.getElementById('goal-progress-rem');

// Monitor & Tables
const posStatusBadge = document.getElementById('pos-status-badge');
const positionContainer = document.getElementById('position-container');
const radarScanStatus = document.getElementById('radar-scan-status');
const radarTbody = document.getElementById('radar-tbody');
const tradesTbody = document.getElementById('trades-tbody');
const terminalLogs = document.getElementById('terminal-logs');
const btnClearLogs = document.getElementById('btn-clear-logs');

// Settings Modal
const btnOpenSettings = document.getElementById('btn-open-settings');
const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const inputDailyTarget = document.getElementById('input-daily-target');
const inputMonthlyTarget = document.getElementById('input-monthly-target');
const selectRiskProfile = document.getElementById('select-risk-profile');
const inputCurrentPin = document.getElementById('input-current-pin');
const inputNewPin = document.getElementById('input-new-pin');
const btnChangePin = document.getElementById('btn-change-pin');
const pinChangeStatus = document.getElementById('pin-change-status');

// Formatters
function formatPrice(num) {
  if (num === undefined || num === null || isNaN(num)) return '--';
  if (num < 1) return '$' + num.toFixed(4);
  if (num < 10) return '$' + num.toFixed(3);
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(vol) {
  if (!vol || isNaN(vol)) return '--';
  if (vol > 1000000000) return '$' + (vol / 1000000000).toFixed(2) + 'B';
  if (vol > 1000000) return '$' + (vol / 1000000).toFixed(1) + 'M';
  return '$' + (vol / 1000).toFixed(0) + 'K';
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toTimeString().slice(0, 8);
}

function formatSeconds(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(v => (v < 10 ? '0' + v : v)).join(':');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Authenticated Fetch Wrapper
async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (authToken) {
    options.headers['Authorization'] = 'Bearer ' + authToken;
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    // Session expired or unauthorized -> show PIN gate
    lockTerminal();
  }
  return res;
}

// --- PIN GATE & SECURITY LOGIC ---

function updatePinDots() {
  pinDots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < currentPinBuffer.length);
  });
}

function showPinError(msg) {
  pinErrorMsg.textContent = msg;
  pinErrorMsg.classList.remove('hidden');
  pinGate.querySelector('.pin-gate-box').classList.add('shake');
  setTimeout(() => pinGate.querySelector('.pin-gate-box').classList.remove('shake'), 400);
}

async function submitPin() {
  if (!currentPinBuffer) {
    showPinError('Vui lòng nhập mã PIN bảo mật.');
    return;
  }

  try {
    keyUnlock.textContent = '...';
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: currentPinBuffer })
    });
    const data = await res.json();

    if (data.success && data.token) {
      authToken = data.token;
      localStorage.setItem('vibe_auth_token', authToken);
      unlockTerminal();
      if (data.trading) state.trading = data.trading;
      if (data.config) state.config = data.config;
      renderAll();
      // Inform websocket
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'AUTH', token: authToken }));
      }
    } else {
      showPinError(data.error || 'Mã PIN không chính xác!');
      currentPinBuffer = '';
      updatePinDots();
    }
  } catch (err) {
    showPinError('Lỗi kết nối bảo mật: ' + err.message);
  } finally {
    keyUnlock.textContent = 'MỞ';
  }
}

function unlockTerminal() {
  pinGate.classList.add('hidden');
  pinErrorMsg.classList.add('hidden');
  currentPinBuffer = '';
  updatePinDots();
}

function lockTerminal() {
  authToken = '';
  localStorage.removeItem('vibe_auth_token');
  pinGate.classList.remove('hidden');
  currentPinBuffer = '';
  updatePinDots();
  if (pinInputHidden) pinInputHidden.focus();
}

// Setup PIN Keypad & Keyboard
function setupPinKeypad() {
  document.querySelectorAll('.key-btn[data-val]').forEach(btn => {
    btn.onclick = () => {
      if (currentPinBuffer.length < 12) {
        currentPinBuffer += btn.getAttribute('data-val');
        updatePinDots();
        pinErrorMsg.classList.add('hidden');
        if (currentPinBuffer.length === 6) {
          // Auto submit at 6 digits
          setTimeout(submitPin, 150);
        }
      }
    };
  });

  keyClear.onclick = () => {
    currentPinBuffer = '';
    updatePinDots();
    pinErrorMsg.classList.add('hidden');
  };

  keyUnlock.onclick = submitPin;

  // Listen for physical keyboard typing
  window.addEventListener('keydown', e => {
    if (pinGate.classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') {
      if (currentPinBuffer.length < 12) {
        currentPinBuffer += e.key;
        updatePinDots();
        pinErrorMsg.classList.add('hidden');
        if (currentPinBuffer.length === 6) {
          setTimeout(submitPin, 150);
        }
      }
    } else if (e.key === 'Backspace') {
      currentPinBuffer = currentPinBuffer.slice(0, -1);
      updatePinDots();
    } else if (e.key === 'Enter') {
      submitPin();
    } else if (e.key === 'Escape') {
      currentPinBuffer = '';
      updatePinDots();
    }
  });

  btnLockTerminal.onclick = lockTerminal;
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(authToken)}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    wsBadge.textContent = '10 COINS LIVE';
    wsBadge.className = 'badge-online';
  };

  ws.onclose = () => {
    wsBadge.textContent = 'MẤT KẾT NỐI (THỬ LẠI)';
    wsBadge.className = 'badge-status-danger';
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = event => {
    try {
      const payload = JSON.parse(event.data);
      handleWsMessage(payload);
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };
}

function handleWsMessage(payload) {
  switch (payload.type) {
    case 'INIT_STATE':
      state = { ...state, ...payload.data };
      if (!payload.data.isAuthenticated && !authToken) {
        lockTerminal();
      } else if (authToken) {
        unlockTerminal();
      }
      if (payload.data.publicUrl) renderPublicUrl(payload.data.publicUrl);
      if (payload.data.isAutoTrading !== undefined) {
        state.isAutoTrading = payload.data.isAutoTrading;
        toggleAutoTrading.checked = state.isAutoTrading;
      }
      renderAll();
      break;

    case 'AUTH_SUCCESS':
      if (payload.data.trading) state.trading = payload.data.trading;
      if (payload.data.logs) state.logs = payload.data.logs;
      renderAll();
      break;

    case 'SYSTEM_PULSE':
      statUptime.textContent = formatSeconds(payload.data.uptimeSeconds);
      if (payload.data.publicUrl && payload.data.publicUrl !== state.publicUrl) {
        state.publicUrl = payload.data.publicUrl;
        renderPublicUrl(state.publicUrl);
      }
      break;

    case 'PUBLIC_URL_READY':
      state.publicUrl = payload.data.publicUrl;
      renderPublicUrl(state.publicUrl);
      break;

    case 'RADAR_TICK':
      handleRadarTick(payload.data);
      break;

    case 'AUTO_TRADING_CHANGED':
      state.isAutoTrading = payload.data.isAutoTrading;
      toggleAutoTrading.checked = state.isAutoTrading;
      break;

    case 'CAPITAL_UPDATED':
      state.trading = { ...state.trading, ...payload.data };
      renderPerformance();
      break;

    case 'LEVERAGE_UPDATED':
      if (state.trading) state.trading.leverage = payload.data.leverage;
      renderLeverage();
      break;

    case 'CONFIG_UPDATED':
      state.config = { ...state.config, ...payload.data };
      renderPerformance();
      break;

    case 'POSITION_OPENED':
      state.trading.activePosition = payload.data;
      renderPosition();
      break;

    case 'POSITION_CLOSED':
      state.trading.activePosition = null;
      state.trading.stats = payload.data.stats;
      state.trading.balanceUSD = payload.data.balanceUSD;
      state.trading.balanceVND = Math.round(payload.data.balanceUSD * (state.config.exchangeRate || 25400));
      if (payload.data.trade) {
        state.trading.tradesHistory = state.trading.tradesHistory || [];
        state.trading.tradesHistory.unshift(payload.data.trade);
      }
      renderPosition();
      renderPerformance();
      renderTradesHistory();
      break;

    case 'LOG_ENTRY':
      addLogEntry(payload.data);
      break;

    case 'LOGS_CLEARED':
      terminalLogs.innerHTML = '<div class="log-line info"><span class="log-msg">Đã làm sạch nhật ký.</span></div>';
      break;

    default:
      break;
  }
}

// Handle Real-time multi-coin ticks
function handleRadarTick(data) {
  if (!data) return;

  if (data.marketRadar && Array.isArray(data.marketRadar)) {
    state.marketRadar = data.marketRadar;
    renderRadarTable();
  }

  if (data.activePosition !== undefined) {
    if (!state.trading) state.trading = {};
    state.trading.activePosition = data.activePosition;
  }
  if (data.balanceUSD !== undefined) state.trading.balanceUSD = data.balanceUSD;
  if (data.balanceVND !== undefined) state.trading.balanceVND = data.balanceVND;
  if (data.realizedPnlUSD !== undefined) state.trading.realizedPnlUSD = data.realizedPnlUSD;
  if (data.stats) state.trading.stats = data.stats;

  renderPosition();
  renderPerformance();
}

function renderAll() {
  renderPerformance();
  renderLeverage();
  renderPosition();
  renderRadarTable();
  renderTradesHistory();
  renderLogs();
}

// Render Public Mobile URL
function renderPublicUrl(url) {
  if (!url) {
    publicWebLink.textContent = 'Đang kích hoạt Cloudflare Tunnel...';
    publicWebLink.href = '#';
    return;
  }
  publicWebLink.textContent = url;
  publicWebLink.href = url;
}

btnCopyPublicUrl.onclick = () => {
  if (!state.publicUrl) return;
  navigator.clipboard.writeText(state.publicUrl);
  alert(`Đã sao chép liên kết truy cập riêng:\n${state.publicUrl}\n\nBạn có thể mở link này trên điện thoại để theo dõi lãi thụ động mọi lúc mọi nơi!`);
};

// Render Performance Strip & Goal Progress
function renderPerformance() {
  const t = state.trading || {};
  const cfg = state.config || {};
  const rate = cfg.exchangeRate || 25400;

  // Capital Card
  if (typeof t.balanceVND === 'string') {
    tradeBalanceVnd.textContent = t.balanceVND;
    tradeBalanceUsd.textContent = '≈ $' + t.balanceUSD;
  } else {
    tradeBalanceVnd.textContent = (t.balanceVND || 500000).toLocaleString('vi-VN') + ' đ';
    tradeBalanceUsd.textContent = '≈ $' + (t.balanceUSD || 19.68).toFixed(2) + ' USD';
  }

  // Capital pill highlight
  const capVND = t.initialCapitalVND || 500000;
  [btnCap500k, btnCap1000k, btnCap2000k, btnCap5000k].forEach(btn => {
    if (!btn) return;
    const v = parseInt(btn.getAttribute('data-vnd'), 10);
    btn.classList.toggle('active', v === capVND);
  });

  // Realized Net Passive Profit
  const pnlUSD = t.realizedPnlUSD || 0;
  const isProfit = pnlUSD >= 0;
  const pnlVND = Math.round(pnlUSD * rate);

  tradePnlUsd.textContent = (isProfit ? '+' : '') + '$' + pnlUSD.toFixed(2);
  tradePnlUsd.className = 'p-main-val mono ' + (isProfit ? 'highlight-green' : 'highlight-red');
  tradePnlVnd.textContent = '≈ ' + (isProfit ? '+' : '') + pnlVND.toLocaleString('vi-VN') + ' đ (Tự động cộng dồn lãi kép)';

  // Daily Passive Income Goal Progress
  const dailyTarget = cfg.dailyTargetUSD || 10.0;
  const todayProfit = t.todayPnlUSD !== undefined ? t.todayPnlUSD : Math.max(0, pnlUSD);
  const targetVND = Math.round(dailyTarget * rate);

  goalTargetLabel.textContent = `$${dailyTarget.toFixed(2)} (~${(targetVND / 1000).toFixed(0)}k đ)`;

  const pct = Math.min(100, Math.max(0, (todayProfit / dailyTarget) * 100));
  goalProgressFill.style.width = pct.toFixed(1) + '%';
  goalProgressPct.textContent = `${pct.toFixed(0)}% Đạt (${todayProfit >= 0 ? '+' : ''}$${todayProfit.toFixed(2)})`;

  const remaining = Math.max(0, dailyTarget - todayProfit);
  goalProgressRem.textContent = remaining <= 0 ? '🎉 Đạt mục tiêu ngày!' : `Còn thiếu $${remaining.toFixed(2)}`;

  // Winrate and counts
  const stats = t.stats || {};
  tradeCounts.textContent = `${stats.wins || 0} Thắng / ${stats.losses || 0} Thua (Tỷ lệ thắng: ${stats.winRate || 0}%)`;
}

// Render Leverage Buttons
function renderLeverage() {
  const t = state.trading || {};
  const lev = t.leverage || 3;
  [btnLev1, btnLev2, btnLev3, btnLev5].forEach(btn => {
    if (!btn) return;
    const l = parseInt(btn.getAttribute('data-lev'), 10);
    btn.classList.toggle('active', l === lev);
  });
  if (levDisplay) {
    levDisplay.textContent = `Đòn bẩy x${lev}`;
  }
}

// Render Position Monitor Card (Supports Single or Multi-Position Portfolio)
function renderPosition() {
  const t = state.trading || {};
  const positions = Array.isArray(t.activePositions) && t.activePositions.length > 0
    ? t.activePositions
    : (t.activePosition ? [t.activePosition] : []);

  if (positions.length === 0) {
    posStatusBadge.textContent = 'CHƯA MỞ LỆNH (0/3)';
    posStatusBadge.className = 'badge-status-idle';
    positionContainer.className = 'position-box idle';
    positionContainer.innerHTML = `
      <div class="pos-idle-msg">
        <span class="idle-icon">📡</span>
        <div>
          <strong>Chưa có vị thế mở — Vốn của bạn đang an toàn 100%</strong>
          <p>Hệ thống AI Multi-Coin Radar đang quét liên tục 10 đồng coin hàng đầu Binance. AI có thể mở đồng thời tối đa <strong>3 vị thế đa coin</strong> (mỗi lệnh 18% vốn theo chuẩn Kelly Criterion) khi phát hiện điểm tiềm năng &ge; 78/100.</p>
        </div>
      </div>
      <div class="quick-order-btns">
        <button class="btn btn-sm btn-long" id="btn-sample-long">▲ Lệnh Mẫu LONG (BTC)</button>
        <button class="btn btn-sm btn-short" id="btn-sample-short">▼ Lệnh Mẫu SHORT (BTC)</button>
      </div>
    `;

    const bLong = document.getElementById('btn-sample-long');
    const bShort = document.getElementById('btn-sample-short');
    if (bLong) bLong.onclick = () => triggerOrder('BTCUSDT', 'LONG');
    if (bShort) bShort.onclick = () => triggerOrder('BTCUSDT', 'SHORT');
    return;
  }

  // Active Positions Open
  posStatusBadge.textContent = `ĐANG GIỮ ${positions.length}/3 VỊ THẾ ĐA COIN`;
  posStatusBadge.className = 'badge-status-safe';

  positionContainer.className = 'position-box active-multi';
  positionContainer.innerHTML = `
    <div class="multi-pos-header">
      <span class="multi-pos-title">DANH MỤC CÁC VỊ THẾ ĐANG MỞ (${positions.length}/3)</span>
      <button id="btn-panic-close-all" class="btn btn-xs btn-panic">🚨 ĐÓNG TOÀN BỘ VỊ THẾ (PANIC CLOSE)</button>
    </div>
    <div class="multi-pos-grid">
      ${positions.map(pos => {
        const isLong = pos.side === 'LONG';
        const isProfit = (pos.unrealizedPnlUSD || 0) >= 0;
        const pnlClass = isProfit ? 'highlight-green' : 'highlight-red';
        const pnlSign = isProfit ? '+' : '';
        const pnlVND = Math.round((pos.unrealizedPnlUSD || 0) * (state.config.exchangeRate || 25400));
        
        let protectionTag = '<span class="status-chip chip-watch">⏳ Trailing SL</span>';
        if (pos.isProfitLocked) protectionTag = '<span class="status-chip chip-locked">🔒 ĐÃ KHÓA LÃI (+1.0%)</span>';
        else if (pos.isBreakevenProtected) protectionTag = '<span class="status-chip chip-safe">🛡️ ĐÃ BẢO VỆ HÒA VỐN</span>';

        return `
          <div class="pos-item-card">
            <div class="pos-item-top">
              <div class="pos-item-coin">
                <span class="pos-coin-icon">${pos.icon || '🪙'}</span>
                <div>
                  <div class="pos-coin-name">${escapeHtml(pos.name || pos.symbol)} <span class="mono">${pos.symbol}</span></div>
                  <div class="pos-side-pill ${isLong ? 'long' : 'short'}">${pos.side} &bull; x${pos.leverage}</div>
                </div>
              </div>
              <div class="pos-item-action">
                <button class="btn btn-xs btn-danger" onclick="closeSinglePosition('${pos.id}')">Đóng Lệnh</button>
              </div>
            </div>

            <div class="pos-reason-box" style="margin: 8px 0;">
              <span class="reason-label">CHIẾN LƯỢC:</span>
              <span class="reason-text">${escapeHtml(pos.reason || 'AI Quantitative Setup')}</span>
            </div>

            <div class="pos-item-prices">
              <div class="price-row">
                <span class="p-lbl">Giá vào:</span>
                <span class="p-val mono">${formatPrice(pos.entryPrice)}</span>
              </div>
              <div class="price-row">
                <span class="p-lbl">Giá hiện tại:</span>
                <span class="p-val mono highlight-cyan">${formatPrice(pos.currentPrice || pos.entryPrice)}</span>
              </div>
              <div class="price-row">
                <span class="p-lbl">Cắt lỗ (SL):</span>
                <span class="p-val mono highlight-red">${formatPrice(pos.stopLoss)}</span>
              </div>
              <div class="price-row">
                <span class="p-lbl">Chốt lời (TP):</span>
                <span class="p-val mono highlight-green">${formatPrice(pos.takeProfit)}</span>
              </div>
            </div>

            <div class="pos-item-bottom">
              <div>
                <div class="pnl-amount mono ${pnlClass}">
                  ${pnlSign}$${(pos.unrealizedPnlUSD || 0).toFixed(2)} (${pnlSign}${(pos.unrealizedPnlPercent || 0).toFixed(2)}%)
                </div>
                <div class="pnl-sub mono ${pnlClass}">≈ ${pnlSign}${pnlVND.toLocaleString('vi-VN')} đ (Ký quỹ $${pos.marginUSD})</div>
              </div>
              <div class="pos-item-chip">
                ${protectionTag}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const btnPanicAll = document.getElementById('btn-panic-close-all');
  if (btnPanicAll) btnPanicAll.onclick = () => panicClose();
}

async function closeSinglePosition(id) {
  if (!confirm('Bạn có chắc muốn đóng vị thế này ngay lập tức?')) return;
  try {
    const res = await authFetch('/api/trading/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason: 'MANUAL_CLOSE' })
    });
    const result = await res.json();
    if (!result.success) {
      alert(result.error || 'Lỗi đóng vị thế.');
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Render 10 Coins Multi-Asset Market Radar
function renderRadarTable() {
  if (!state.marketRadar || state.marketRadar.length === 0) return;

  radarScanStatus.textContent = `AI đang quét 10 coin Binance theo thời gian thực (Cập nhật: ${new Date().toLocaleTimeString()})`;

  const sorted = [...state.marketRadar].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));

  radarTbody.innerHTML = sorted.map(coin => {
    const prev = previousPrices[coin.symbol] || coin.price;
    let flashClass = '';
    if (coin.price > prev) flashClass = 'price-flash-up';
    else if (coin.price < prev) flashClass = 'price-flash-down';
    previousPrices[coin.symbol] = coin.price;

    const isUp = coin.change24h >= 0;
    const chgClass = isUp ? 'highlight-green' : 'highlight-red';
    const chgSign = isUp ? '+' : '';

    let signalBadge = '<span class="badge-signal neutral">TRUNG LẬP</span>';
    if (coin.signal === 'STRONG_BUY') signalBadge = '<span class="badge-signal strong-buy">🔥 MUA MẠNH</span>';
    else if (coin.signal === 'BUY') signalBadge = '<span class="badge-signal buy">⚡ MUA</span>';
    else if (coin.signal === 'STRONG_SELL') signalBadge = '<span class="badge-signal strong-sell">🔻 BÁN MẠNH</span>';
    else if (coin.signal === 'SELL') signalBadge = '<span class="badge-signal sell">BÁN</span>';

    const scorePct = Math.min(100, Math.max(0, coin.opportunityScore || 50));
    const scoreColor = scorePct >= 80 ? 'var(--success)' : (scorePct >= 70 ? 'var(--primary)' : 'var(--text-dim)');

    return `
      <tr class="${flashClass}">
        <td>
          <div class="coin-cell">
            <span class="coin-icon">${coin.icon || '🪙'}</span>
            <div>
              <div class="coin-name">${escapeHtml(coin.name || coin.symbol)}</div>
              <div class="coin-sym mono">${coin.symbol}</div>
            </div>
          </div>
        </td>
        <td class="mono font-bold">${formatPrice(coin.price)}</td>
        <td class="mono font-bold ${chgClass}">${chgSign}${coin.change24h ? coin.change24h.toFixed(2) : 0.00}%</td>
        <td class="mono font-xs text-muted">
          <div>H: ${formatPrice(coin.high24h)}</div>
          <div>L: ${formatPrice(coin.low24h)}</div>
        </td>
        <td class="mono font-xs">${formatVolume(coin.volume)}</td>
        <td class="mono font-bold">${coin.rsi || 50}</td>
        <td>
          <div class="score-cell">
            <div class="score-num mono" style="color: ${scoreColor}; font-weight:700;">${scorePct}/100</div>
            <div class="score-bar-bg">
              <div class="score-bar-fill" style="width: ${scorePct}%; background-color: ${scoreColor};"></div>
            </div>
          </div>
        </td>
        <td class="font-xs setup-text">${escapeHtml(coin.setupType || 'Rà soát tín hiệu...')}</td>
        <td>${signalBadge}</td>
        <td style="text-align:center;">
          <div class="table-actions">
            <button class="btn btn-table btn-table-long" onclick="triggerOrder('${coin.symbol}', 'LONG')" title="Vào lệnh LONG cho ${coin.symbol}">▲ LONG</button>
            <button class="btn btn-table btn-table-short" onclick="triggerOrder('${coin.symbol}', 'SHORT')" title="Vào lệnh SHORT cho ${coin.symbol}">▼ SHORT</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Closed Trades History
function renderTradesHistory() {
  const t = state.trading || {};
  const history = t.tradesHistory || [];

  if (history.length === 0) {
    tradesTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim); padding:24px;">Chưa có lệnh nào được đóng. Lãi thụ động sẽ hiển thị tại đây khi chốt.</td></tr>`;
    return;
  }

  tradesTbody.innerHTML = history.slice(0, 30).map(tr => {
    const isWin = tr.pnlUSD > 0;
    const pnlClass = isWin ? 'highlight-green' : 'highlight-red';
    const pnlSign = isWin ? '+' : '';
    const sideClass = tr.side === 'LONG' ? 'tag-long' : 'tag-short';

    return `
      <tr>
        <td><span class="trade-side-tag ${sideClass}">${tr.side} x${tr.leverage || 3}</span></td>
        <td class="mono font-bold">${tr.symbol}</td>
        <td class="mono">${formatPrice(tr.entryPrice)}</td>
        <td class="mono">${formatPrice(tr.closePrice)}</td>
        <td class="mono">$${(tr.marginUSD || 0).toFixed(2)}</td>
        <td class="mono font-bold ${pnlClass}">
          ${pnlSign}$${(tr.pnlUSD || 0).toFixed(2)} (${pnlSign}${(tr.pnlPercent || 0).toFixed(2)}%)
        </td>
        <td class="font-xs">${escapeHtml(tr.closeReason || 'Manual Exit')}</td>
        <td class="font-xs mono text-muted">${formatTime(tr.closeTime)}</td>
      </tr>
    `;
  }).join('');
}

// Render Telemetry Logs
function renderLogs() {
  const logs = state.logs || [];
  if (logs.length === 0) return;
  terminalLogs.innerHTML = logs.map(l => createLogLineHtml(l)).join('');
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

function addLogEntry(l) {
  state.logs = state.logs || [];
  state.logs.unshift(l);
  if (state.logs.length > 100) state.logs = state.logs.slice(0, 100);

  const div = document.createElement('div');
  div.innerHTML = createLogLineHtml(l);
  if (div.firstElementChild) {
    terminalLogs.appendChild(div.firstElementChild);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
}

function createLogLineHtml(l) {
  const lvlClass = (l.level || 'info').toLowerCase();
  const time = l.timestamp ? l.timestamp.slice(11, 19) : '00:00:00';
  return `
    <div class="log-line ${lvlClass}">
      <span class="log-time">[${time}]</span>
      <span class="log-source">[${escapeHtml(l.source || 'QuantAI')}]</span>
      <span class="log-msg">${escapeHtml(l.message || '')}</span>
    </div>
  `;
}

// User Action Handlers (Protected with authFetch)
async function triggerOrder(symbol, side) {
  try {
    const res = await authFetch('/api/trading/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, side })
    });
    const result = await res.json();
    if (!result.success) {
      alert(result.error || 'Không thể mở lệnh.');
    }
  } catch (err) {
    alert('Lỗi gửi lệnh: ' + err.message);
  }
}

async function panicClose() {
  if (!confirm('Bạn có chắc chắn muốn ĐÓNG KHẨN CẤP vị thế hiện tại ngay lập tức?')) return;
  try {
    const res = await authFetch('/api/trading/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (!result.success) {
      alert(result.error || 'Lỗi đóng vị thế.');
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Auto Trading Toggle
toggleAutoTrading.onchange = async () => {
  const enabled = toggleAutoTrading.checked;
  try {
    await authFetch('/api/trading/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  } catch (e) {
    console.error('Lỗi bật tắt auto trading:', e);
  }
};

// Capital Selection
function setupCapitalButtons() {
  const map = [
    { btn: btnCap500k, vnd: 500000 },
    { btn: btnCap1000k, vnd: 1000000 },
    { btn: btnCap2000k, vnd: 2000000 },
    { btn: btnCap5000k, vnd: 5000000 }
  ];

  map.forEach(item => {
    if (!item.btn) return;
    item.btn.onclick = async () => {
      try {
        await authFetch('/api/trading/capital', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountVND: item.vnd })
        });
      } catch (err) {
        alert('Lỗi cài đặt vốn: ' + err.message);
      }
    };
  });
}

// Leverage Selection
function setupLeverageButtons() {
  const levs = [
    { btn: btnLev1, lev: 1 },
    { btn: btnLev2, lev: 2 },
    { btn: btnLev3, lev: 3 },
    { btn: btnLev5, lev: 5 }
  ];

  levs.forEach(item => {
    if (!item.btn) return;
    item.btn.onclick = async () => {
      try {
        await authFetch('/api/trading/leverage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leverage: item.lev })
        });
      } catch (err) {
        alert('Lỗi điều chỉnh đòn bẩy: ' + err.message);
      }
    };
  });
}

// Settings Modal & Change PIN Handlers
function setupSettingsModal() {
  btnOpenSettings.onclick = () => {
    const cfg = state.config || {};
    inputDailyTarget.value = cfg.dailyTargetUSD || 10;
    inputMonthlyTarget.value = cfg.monthlyTargetUSD || 300;
    selectRiskProfile.value = cfg.riskProfile || 'balanced';
    pinChangeStatus.textContent = '';
    inputCurrentPin.value = '';
    inputNewPin.value = '';
    modalSettings.classList.remove('hidden');
  };

  btnCloseSettings.onclick = () => modalSettings.classList.add('hidden');
  btnCancelSettings.onclick = () => modalSettings.classList.add('hidden');

  btnSaveSettings.onclick = async () => {
    const dailyTargetUSD = parseFloat(inputDailyTarget.value) || 10;
    const monthlyTargetUSD = parseFloat(inputMonthlyTarget.value) || 300;
    const riskProfile = selectRiskProfile.value;

    try {
      const res = await authFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyTargetUSD, monthlyTargetUSD, riskProfile })
      });
      const data = await res.json();
      if (data.success) {
        modalSettings.classList.add('hidden');
      }
    } catch (e) {
      alert('Lỗi lưu cấu hình: ' + e.message);
    }
  };

  btnChangePin.onclick = async () => {
    const currentPin = inputCurrentPin.value.trim();
    const newPin = inputNewPin.value.trim();
    if (!currentPin || !newPin) {
      pinChangeStatus.textContent = 'Vui lòng nhập cả mã PIN hiện tại và mã PIN mới.';
      pinChangeStatus.style.color = 'var(--danger)';
      return;
    }

    try {
      btnChangePin.textContent = 'Đang đổi...';
      const res = await authFetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json();
      if (data.success) {
        pinChangeStatus.textContent = 'Đổi mã PIN thành công! Hãy ghi nhớ mã PIN mới của bạn.';
        pinChangeStatus.style.color = 'var(--success)';
        inputCurrentPin.value = '';
        inputNewPin.value = '';
      } else {
        pinChangeStatus.textContent = data.error || 'Đổi mã PIN thất bại!';
        pinChangeStatus.style.color = 'var(--danger)';
      }
    } catch (err) {
      pinChangeStatus.textContent = 'Lỗi kết nối: ' + err.message;
      pinChangeStatus.style.color = 'var(--danger)';
    } finally {
      btnChangePin.textContent = 'Cập Nhật Mã PIN Mới';
    }
  };
}

// Clear Logs
btnClearLogs.onclick = async () => {
  try {
    await authFetch('/api/logs/clear', { method: 'POST' });
  } catch (e) {
    console.error('Lỗi xoá log:', e);
  }
};

// Initial bootstrap
setupPinKeypad();
setupCapitalButtons();
setupLeverageButtons();
setupSettingsModal();

// If we already have a saved token, verify it silently
if (authToken) {
  authFetch('/api/trading/status')
    .then(r => r.json())
    .then(data => {
      if (data.isAuthenticated) {
        unlockTerminal();
        if (data.trading) state.trading = data.trading;
        if (data.config) state.config = data.config;
        renderAll();
      } else {
        lockTerminal();
      }
    })
    .catch(() => lockTerminal());
} else {
  lockTerminal();
}

connectWebSocket();
