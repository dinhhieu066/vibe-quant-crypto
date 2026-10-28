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
  if (window.poodle3D && !window.poodle3D.hasGreeted) {
    window.poodle3D.hasGreeted = true;
    window.poodle3D.ensureAudioContext();
    setTimeout(() => {
      window.poodle3D.speak('Gâu gâu! Em Poodle 3D xin chào sếp! Em đang canh gác và săn kèo Binance 24 trên 7 cho sếp đây!');
    }, 400);
  }
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
    wsBadge.textContent = '⚡ 350+ COINS LIVE';
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
      if (window.poodle3D && payload.data && payload.data.symbol) {
        window.poodle3D.speak(`Gâu gâu! Sếp ơi, em vừa phát hiện kèo thơm và đã ngoạm lệnh ${payload.data.symbol} ${payload.data.side || 'LONG'} rồi nè sếp!`);
      }
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
      if (window.poodle3D && payload.data && payload.data.trade) {
        const tr = payload.data.trade;
        if (tr.pnlUSD > 0) {
          window.poodle3D.speak(`Gâu gâu! Chúc mừng sếp, em vừa chốt lãi thành công cộng thêm ${tr.pnlUSD.toFixed(2)} đô vào ví sếp rồi nha!`);
        } else {
          window.poodle3D.speak(`Em đã kích hoạt cắt lỗ thông minh để bảo vệ an toàn vốn cho sếp rồi ạ!`);
        }
      }
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

  if (data.totalCoinsScanned) {
    state.totalCoinsScanned = data.totalCoinsScanned;
    if (wsBadge) {
      wsBadge.textContent = `⚡ ${data.totalCoinsScanned} COINS LIVE`;
    }
  }

  if (data.marketRadar && Array.isArray(data.marketRadar)) {
    state.marketRadar = data.marketRadar;
    renderRadarTable();
  }

  if (data.activePositions !== undefined) {
    if (!state.trading) state.trading = {};
    state.trading.activePositions = data.activePositions;
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
        <span class="idle-poodle-icon">🐩</span>
        <div>
          <strong>Vốn của sếp đang an toàn tuyệt đối 100%</strong>
          <p>Em Poodle đang quét liên tục 400+ coin trên Binance. AI chỉ tự động kích hoạt lệnh khi phát hiện cơ hội đẹp nhất thị trường (Điểm tiềm năng &ge; 78/100).</p>
        </div>
      </div>
    `;
    updatePoodleMood('hunting');
    return;
  }

  // Active Positions Open
  posStatusBadge.textContent = `POODLE ĐANG CẮN ${positions.length}/3 KÈO`;
  posStatusBadge.className = 'badge-status-safe';
  updatePoodleMood('active', positions);

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
        
        // Dynamic price tick flash
        const prevKey = pos.id || pos.symbol;
        const prevPrice = previousPrices[prevKey];
        let tickClass = '';
        if (prevPrice !== undefined && pos.currentPrice !== undefined) {
          if (pos.currentPrice > prevPrice) tickClass = 'tick-flash-up';
          else if (pos.currentPrice < prevPrice) tickClass = 'tick-flash-down';
        }
        previousPrices[prevKey] = pos.currentPrice;

        // Scalping elapsed timer
        const openMs = new Date(pos.openTime || Date.now()).getTime();
        const elapsedSec = Math.max(0, Math.floor((Date.now() - openMs) / 1000));
        const elapsedFormatted = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}p ${elapsedSec % 60}s`;

        let protectionTag = '<span class="status-chip chip-watch">⏳ Trailing SL</span>';
        if (pos.isProfitLocked) protectionTag = '<span class="status-chip chip-locked">🔒 ĐÃ KHÓA LÃI (+0.35%)</span>';
        else if (pos.isBreakevenProtected) protectionTag = '<span class="status-chip chip-safe">🛡️ ĐÃ BẢO VỆ HÒA VỐN</span>';

        return `
          <div class="pos-item-card">
            <div class="pos-item-top">
              <div class="pos-item-coin">
                <span class="pos-coin-icon">${pos.icon || '🪙'}</span>
                <div>
                  <div class="pos-coin-name">
                    ${escapeHtml(pos.name || pos.symbol)} <span class="mono">${pos.symbol}</span>
                    <span class="live-dot-pulse">● LIVE</span>
                    <span class="mono" style="font-size:10px; color:var(--text-dim); margin-left:4px;">⏱️ ${elapsedFormatted}</span>
                  </div>
                  <div class="pos-side-pill ${isLong ? 'long' : 'short'}">${pos.side} &bull; x${pos.leverage}</div>
                </div>
              </div>
              <div class="pos-item-action">
                <button class="btn btn-xs btn-danger" onclick="closeSinglePosition('${pos.id}')">Đóng Lệnh</button>
              </div>
            </div>

            <div class="pos-reason-box" style="margin: 8px 0;">
              <span class="reason-label">CHIẾN LƯỢC (${escapeHtml(pos.causalRuleId || 'SMC-01')}):</span>
              <span class="reason-text">${escapeHtml(pos.causalTitle || pos.reason || 'AI Quantitative Scalp')}</span>
              ${pos.mmBehavior ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">🐋 <strong>MM Behavior:</strong> ${escapeHtml(pos.mmBehavior)}</div>` : ''}
            </div>

            <div class="pos-item-prices">
              <div class="price-row">
                <span class="p-lbl">Giá vào:</span>
                <span class="p-val mono">${formatPrice(pos.entryPrice)}</span>
              </div>
              <div class="price-row">
                <span class="p-lbl">Giá hiện tại:</span>
                <span class="p-val mono highlight-cyan ${tickClass}">${formatPrice(pos.currentPrice || pos.entryPrice)}</span>
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

// Render All-Market Multi-Asset Market Radar
function renderRadarTable() {
  if (!state.marketRadar || state.marketRadar.length === 0) return;

  const total = state.totalCoinsScanned || 350;
  radarScanStatus.textContent = `AI đang quét ${total}+ coin Binance thời gian thực • Top ${state.marketRadar.length} cơ hội tốt nhất (Cập nhật: ${new Date().toLocaleTimeString()})`;

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
        <td>
          <button class="btn btn-xs btn-outline" onclick="analyzeCoinCausal('${coin.symbol}', true)">🧠 Phân Tích</button>
        </td>
      </tr>
    `;
  }).join('');

  populateCausalCoinSelect(sorted);
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
// --- POODLE MASCOT MOOD & SPEECH SYSTEM ---
function updatePoodleMood(type, positions = []) {
  const poodleSpeech = document.getElementById('poodle-speech');
  const poodleMoodBadge = document.getElementById('poodle-mood-badge');
  const heroWinrate = document.getElementById('hero-winrate');
  const heroCoinsCount = document.getElementById('hero-coins-count');

  if (state.trading && state.trading.stats && heroWinrate) {
    const wr = state.trading.stats.winRate;
    heroWinrate.textContent = `${wr > 0 ? wr : 100}%`;
  }
  if (state.totalCoinsScanned && heroCoinsCount) {
    heroCoinsCount.textContent = state.totalCoinsScanned;
  }

  if (!poodleSpeech || !poodleMoodBadge) return;

  if (type === 'active' && positions.length > 0) {
    poodleMoodBadge.textContent = `🐩 ĐANG CẮN ${positions.length} KÈO THƠM`;
    poodleMoodBadge.className = 'mood-badge mood-active';

    const symbols = positions.map(p => {
      const pnl = p.unrealizedPnlPercent || 0;
      const sign = pnl >= 0 ? '+' : '';
      return `${p.symbol} (${sign}${pnl}%)`;
    }).join(', ');

    const anyLocked = positions.some(p => p.isProfitLocked || p.isBreakevenProtected);
    if (anyLocked) {
      poodleSpeech.innerHTML = `"Gâu gâu! Em Poodle đã <strong>khóa hòa vốn & bảo vệ lãi</strong> ở kèo [${symbols}]. Tiền trong ví chỉ có tăng, không thể lỗ!"`;
    } else {
      poodleSpeech.innerHTML = `"Gâu! Em Poodle đang cắn chặt các kèo [<strong>${symbols}</strong>]. Em đang bám sát từng giây để kéo Stop Loss và chốt lãi cho sếp!"`;
    }
  } else {
    poodleMoodBadge.textContent = `🐾 ĐANG LÙNG SỤC 400+ COIN`;
    poodleMoodBadge.className = 'mood-badge mood-hunting';
    const total = state.totalCoinsScanned || 407;
    poodleSpeech.innerHTML = `"Gâu gâu! Em Poodle đang lùng sục toàn bộ <strong>${total}+ coin</strong> trên Binance. Khi có kèo ngon nhất thị trường (Điểm ≥ 78), em sẽ tự động ngoạm ngay cho sếp!"`;
  }
}

function initPoodle3D() {
  const container = document.getElementById('poodle-3d-canvas-container');
  if (!container || typeof Poodle3D === 'undefined') return;

  try {
    window.poodle3D = new Poodle3D('poodle-3d-canvas-container');
  } catch (err) {
    console.error('Error creating Poodle3D:', err);
  }

  // Voice toggle button
  const btnVoice = document.getElementById('btn-toggle-voice');
  if (btnVoice) {
    const isMuted = window.poodle3D ? window.poodle3D.isMuted : false;
    btnVoice.textContent = isMuted ? '🔇 BẬT GIỌNG NÓI' : '🔊 TẮT GIỌNG NÓI';
    btnVoice.classList.toggle('active', !isMuted);

    btnVoice.onclick = () => {
      if (window.poodle3D) {
        const muted = window.poodle3D.toggleMute();
        btnVoice.textContent = muted ? '🔇 BẬT GIỌNG NÓI' : '🔊 TẮT GIỌNG NÓI';
        btnVoice.classList.toggle('active', !muted);
      }
    };
  }

  // Quick Chat buttons
  const btnChatMarket = document.getElementById('btn-chat-market');
  if (btnChatMarket) {
    btnChatMarket.onclick = () => {
      if (!window.poodle3D) return;
      window.poodle3D.ensureAudioContext();
      const radar = state.marketRadar || [];
      if (radar.length > 0) {
        const top = [...radar].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))[0];
        const speech = `Gâu gâu! Hiện tại đồng ${top.symbol} đang có điểm tiềm năng cao nhất thị trường với ${top.opportunityScore} trên 100 điểm. Em đang theo dõi sát sao nè sếp!`;
        const speechEl = document.getElementById('poodle-speech');
        if (speechEl) speechEl.innerHTML = `"${speech}"`;
        window.poodle3D.speak(speech);
      } else {
        const speech = 'Gâu gâu! Em đang lùng sục toàn bộ hơn bốn trăm đồng coin trên Binance, sếp đợi em chút xíu nhé!';
        const speechEl = document.getElementById('poodle-speech');
        if (speechEl) speechEl.innerHTML = `"${speech}"`;
        window.poodle3D.speak(speech);
      }
    };
  }

  const btnChatSafety = document.getElementById('btn-chat-safety');
  if (btnChatSafety) {
    btnChatSafety.onclick = () => {
      if (!window.poodle3D) return;
      window.poodle3D.ensureAudioContext();
      const speech = 'Vốn của sếp đang an toàn tuyệt đối 100%! Em phân bổ theo công thức Fractional Kelly tối đa 18% mỗi lệnh kèm cắt lỗ động theo ATR, nên không bao giờ cháy ví đâu sếp yên tâm nha!';
      const speechEl = document.getElementById('poodle-speech');
      if (speechEl) speechEl.innerHTML = `"${speech}"`;
      window.poodle3D.speak(speech);
    };
  }

  const btnChatCausal = document.getElementById('btn-chat-causal');
  if (btnChatCausal) {
    btnChatCausal.onclick = async () => {
      const radar = state.marketRadar || [];
      const topSymbol = radar.length > 0
        ? [...radar].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))[0].symbol
        : 'BTCUSDT';
      await analyzeCoinCausal(topSymbol, true);
    };
  }

  const btnChatPet = document.getElementById('btn-chat-pet');
  if (btnChatPet) {
    btnChatPet.onclick = () => {
      if (window.poodle3D) {
        window.poodle3D.ensureAudioContext();
        window.poodle3D.petPoodle();
      }
    };
  }
}

// --- QUANT KNOWLEDGE BASE & CAUSAL RAG CONTEXT RETRIEVER UI ---
let currentPillarFilter = 'ALL';
let hasInitializedCausalAnalyzer = false;

function populateCausalCoinSelect(sortedCoins = []) {
  const sel = document.getElementById('select-causal-coin');
  if (!sel || sortedCoins.length === 0) return;

  const currentVal = sel.value;
  const top20 = sortedCoins.slice(0, 20);
  sel.innerHTML = `<option value="">-- Tự động chọn Top 1 (${top20[0].symbol}) --</option>` +
    top20.map(c => `<option value="${c.symbol}">${c.symbol} (Điểm: ${c.opportunityScore}/100 | RSI: ${c.rsi})</option>`).join('');

  if (currentVal && top20.some(c => c.symbol === currentVal)) {
    sel.value = currentVal;
  }

  if (!hasInitializedCausalAnalyzer && top20.length > 0) {
    hasInitializedCausalAnalyzer = true;
    analyzeCoinCausal(top20[0].symbol, false);
  }
}

async function loadKnowledgeBaseUI() {
  try {
    const res = await fetch('/api/knowledge/summary');
    const json = await res.json();
    if (json.success && json.data) {
      state.knowledgeSummary = json.data;
      const statPillars = document.getElementById('kb-stat-pillars');
      const statRules = document.getElementById('kb-stat-rules');
      const statChunks = document.getElementById('kb-stat-chunks');

      if (statPillars) statPillars.textContent = `${json.data.totalPillars} Trụ Cột Cốt Lõi`;
      if (statRules) statRules.textContent = `${json.data.totalRules} Quy Tắc Nhân Quả`;
      if (statChunks) statChunks.textContent = `${json.data.totalRagChunks} Phân Đoạn RAG (.MD)`;

      renderCausalRuleCards(json.data.rules || []);
    }
  } catch (err) {
    console.error('Error loading Knowledge Base summary:', err);
  }
}

function renderCausalRuleCards(rules = []) {
  const grid = document.getElementById('kb-rules-grid');
  if (!grid) return;

  if (!rules || rules.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-dim);">Không tìm thấy quy tắc nhân quả phù hợp với từ khóa.</div>`;
    return;
  }

  grid.innerHTML = rules.map(r => {
    const dirClass = r.direction === 'LONG'
      ? 'highlight-green'
      : (r.direction === 'SHORT' ? 'highlight-red' : 'text-accent');
    const c = r.causalChain || {};
    const sm = r.sizingModel || {};

    return `
      <div class="kb-rule-card">
        <div class="kb-rule-top">
          <span class="kb-rule-id mono">${escapeHtml(r.id)}</span>
          <span class="kb-rule-pillar">${escapeHtml(r.pillarName || r.pillar)}</span>
          <span class="kb-rule-dir mono ${dirClass}">${escapeHtml(r.direction)}</span>
        </div>
        <h4 class="kb-rule-title">${escapeHtml(r.title)}</h4>
        <div class="kb-causal-steps">
          <div class="kb-c-row">
            <span class="kb-c-lbl">1. Bối cảnh:</span>
            <span class="kb-c-txt">${escapeHtml(c.marketContext)}</span>
          </div>
          <div class="kb-c-row">
            <span class="kb-c-lbl">2. Dấu hiệu dữ liệu:</span>
            <span class="kb-c-txt">${escapeHtml(c.dataSignals)}</span>
          </div>
          <div class="kb-c-row">
            <span class="kb-c-lbl">3. Hành vi Cá mập (MM):</span>
            <span class="kb-c-txt">${escapeHtml(c.mmBehavior)}</span>
          </div>
          <div class="kb-c-row">
            <span class="kb-c-lbl">4. Kịch bản hành động:</span>
            <span class="kb-c-txt">${escapeHtml(c.actionPlan)}</span>
          </div>
        </div>
        <div class="kb-rule-footer mono">
          <span>WinRate cơ sở: <strong>${sm.baseWinRate ? Math.round(sm.baseWinRate * 100) + '%' : 'Quarter-Kelly'}</strong></span>
          <span>R:R tối ưu: <strong>1:${sm.targetRR || sm.minRR || 1.8}</strong></span>
          <span>ATR SL: <strong>${sm.atrSlMultiplier || sm.defaultAtrMultiplier || 1.5}x ATR</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

async function analyzeCoinCausal(symbol, scrollAndSpeak = false) {
  try {
    const sel = document.getElementById('select-causal-coin');
    const targetSymbol = symbol || (sel ? sel.value : '');

    const res = await fetch('/api/knowledge/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: targetSymbol })
    });
    const json = await res.json();
    if (!json.success || !json.analysis) return;

    const a = json.analysis;
    const cs = a.causalSynthesis || {};
    const rs = a.riskSizing || {};

    const elContext = document.getElementById('causal-step-context');
    const elSignals = document.getElementById('causal-step-signals');
    const elMm = document.getElementById('causal-step-mm');
    const elAction = document.getElementById('causal-step-action');

    if (elContext) elContext.textContent = cs.marketContext || '';
    if (elSignals) elSignals.innerHTML = escapeHtml(cs.dataSignals || '').replace(/\n/g, '<br>');
    if (elMm) elMm.textContent = cs.mmBehavior || '';
    if (elAction) elAction.textContent = cs.actionPlan || '';

    // Update Kelly & ATR Sizing Strip
    const elRuleId = document.getElementById('sizing-rule-id');
    const elWr = document.getElementById('sizing-winrate');
    const elRr = document.getElementById('sizing-rr');
    const elKelly = document.getElementById('sizing-kelly');
    const elAtr = document.getElementById('sizing-atr');
    const elSl = document.getElementById('sizing-sl');
    const elTp = document.getElementById('sizing-tp');
    const elPrompt = document.getElementById('llm-prompt-content');

    if (elRuleId) elRuleId.textContent = `${cs.primaryRuleId || 'SMC-01'} (${a.recommendedSide})`;
    if (elWr) elWr.textContent = `${rs.winRateEstPct || 64}%`;
    if (elRr) elRr.textContent = `1 : ${rs.rewardRiskRatio || 2.0}`;
    if (elKelly) elKelly.textContent = `${rs.allocatedMarginPct || 18}% Vốn ($${rs.marginUSD || 3.54})`;
    if (elAtr) elAtr.textContent = `${rs.atrPct || 0.55}% ($${rs.atrValue || 0})`;
    if (elSl) elSl.textContent = `$${rs.recommendedSL} (-${rs.slDistancePct}%)`;
    if (elTp) elTp.textContent = `$${rs.recommendedTP} (+${rs.tpDistancePct}%)`;
    if (elPrompt) elPrompt.textContent = a.llmPromptContext || '';

    if (scrollAndSpeak) {
      const kbSection = document.getElementById('kb-section');
      if (kbSection) kbSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const speech = `Gâu gâu! Em đã truy xuất Knowledge Base 4 trụ cột cho đồng ${a.symbol}: Khớp quy tắc ${cs.primaryRuleId}, khuyến nghị ${a.recommendedSide} với xác suất thắng ${rs.winRateEstPct} phần trăm, cắt lỗ chuẩn ATR tại ${rs.recommendedSL} đô và phân bổ vốn Fractional Kelly ${rs.allocatedMarginPct} phần trăm!`;
      const speechEl = document.getElementById('poodle-speech');
      if (speechEl) speechEl.innerHTML = `"${speech}"`;
      if (window.poodle3D) {
        window.poodle3D.ensureAudioContext();
        window.poodle3D.speak(speech);
      }
    }
  } catch (err) {
    console.error('Error analyzing coin causal state:', err);
  }
}

function setupKnowledgeBaseControls() {
  const tabsWrap = document.getElementById('kb-pillar-tabs');
  const searchInput = document.getElementById('input-kb-search');
  const btnAnalyze = document.getElementById('btn-run-causal-analyzer');
  const btnTogglePrompt = document.getElementById('btn-toggle-llm-prompt');
  const promptBox = document.getElementById('llm-prompt-box');
  const btnCopyPrompt = document.getElementById('btn-copy-llm-prompt');
  const btnViewDoc = document.getElementById('btn-view-pillar-doc');
  const mdViewer = document.getElementById('kb-markdown-viewer');
  const btnCloseMd = document.getElementById('btn-close-md-viewer');

  async function triggerSearch() {
    const q = searchInput ? searchInput.value.trim() : '';
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&pillar=${encodeURIComponent(currentPillarFilter)}`);
      const json = await res.json();
      if (json.success && json.data) {
        renderCausalRuleCards(json.data.rules || []);
      }
    } catch (e) {
      console.error('KB search error:', e);
    }
  }

  if (tabsWrap) {
    tabsWrap.querySelectorAll('.kb-tab').forEach(btn => {
      btn.onclick = () => {
        tabsWrap.querySelectorAll('.kb-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPillarFilter = btn.getAttribute('data-pillar') || 'ALL';
        triggerSearch();
      };
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      triggerSearch();
    });
  }

  if (btnAnalyze) {
    btnAnalyze.onclick = () => {
      const sel = document.getElementById('select-causal-coin');
      analyzeCoinCausal(sel ? sel.value : '', true);
    };
  }

  if (btnTogglePrompt && promptBox) {
    btnTogglePrompt.onclick = () => {
      promptBox.classList.toggle('hidden');
    };
  }

  if (btnCopyPrompt) {
    btnCopyPrompt.onclick = () => {
      const pre = document.getElementById('llm-prompt-content');
      if (pre && pre.textContent) {
        navigator.clipboard.writeText(pre.textContent);
        btnCopyPrompt.textContent = '✅ Đã sao chép!';
        setTimeout(() => { btnCopyPrompt.textContent = 'Sao chép Prompt'; }, 2000);
      }
    };
  }

  if (btnViewDoc && mdViewer) {
    btnViewDoc.onclick = async () => {
      const targetPillar = currentPillarFilter === 'ALL' ? 'SMC' : currentPillarFilter;
      try {
        const res = await fetch(`/api/knowledge/document/${targetPillar}`);
        const json = await res.json();
        if (json.success) {
          const titleEl = document.getElementById('kb-md-title');
          const bodyEl = document.getElementById('kb-md-body');
          if (titleEl) titleEl.textContent = `📖 TÀI LIỆU CHUẨN HÓA: TRỤ CỘT ${targetPillar} (.MD)`;
          if (bodyEl) bodyEl.textContent = json.markdown || '';
          mdViewer.classList.remove('hidden');
        }
      } catch (e) {
        console.error('Error loading markdown doc:', e);
      }
    };
  }

  if (btnCloseMd && mdViewer) {
    btnCloseMd.onclick = () => mdViewer.classList.add('hidden');
  }
}

setupPinKeypad();
setupCapitalButtons();
setupLeverageButtons();
setupSettingsModal();
setupKnowledgeBaseControls();
loadKnowledgeBaseUI();
initPoodle3D();

// If we already have a saved token, verify it silently
if (authToken) {
  authFetch('/api/trading/status')
    .then(r => r.json())
    .then(data => {
      if (data.isAuthenticated) {
        unlockTerminal();
        if (data.trading) state.trading = data.trading;
        if (data.config) state.config = data.config;
        if (data.marketRadar) state.marketRadar = data.marketRadar;
        if (data.totalCoinsScanned) {
          state.totalCoinsScanned = data.totalCoinsScanned;
          if (wsBadge) wsBadge.textContent = `⚡ ${data.totalCoinsScanned} COINS LIVE`;
        }
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
