const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const db = require('./db');
const QuantEngine = require('./quantEngine');

// Crash prevention handlers for abrupt socket resets
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION PREVENTED]', err.message);
  try { db.addLog('WARN', 'System', `Socket anomaly caught: ${err.message}`); } catch {}
});
process.on('unhandledRejection', reason => {
  console.error('[UNHANDLED REJECTION PREVENTED]', reason);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- SECURITY LAYER 1: HTTP SECURITY HEADERS ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- SECURITY LAYER 2: SESSION TOKEN STORE & AUTH MIDDLEWARE ---
const authenticatedTokens = new Set();

function generateAuthToken() {
  const token = crypto.randomBytes(32).toString('hex');
  authenticatedTokens.add(token);
  return token;
}

function isValidToken(token) {
  return !!(token && authenticatedTokens.has(token));
}

// Middleware to guard sensitive endpoints
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : (req.headers['x-terminal-token'] || req.query.token);

  if (!isValidToken(token)) {
    return res.status(401).json({
      success: false,
      error: 'Xác thực thất bại! Vui lòng nhập mã PIN bảo mật để điều khiển trạm.'
    });
  }
  next();
}

// Broadcast to all connected WebSocket clients
function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Initialize Quant Trading Engine
const quantEngine = new QuantEngine(broadcast);

// WebSocket connection handling (Authenticated or Public Stream)
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const isAuth = isValidToken(token);

  const data = db.load();

  // Send state (if not authenticated, hide sensitive balances until PIN is verified)
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      data: {
        isAuthenticated: isAuth,
        trading: isAuth ? db.getTrading() : {
          balanceVND: '••••••',
          balanceUSD: '•••',
          realizedPnlUSD: 0,
          leverage: 3,
          activePosition: null,
          tradesHistory: [],
          stats: { totalTrades: 0, wins: 0, losses: 0, winRate: 0 }
        },
        config: db.getConfig(),
        marketRadar: Object.values(quantEngine.marketData),
        isAutoTrading: quantEngine.isAutoTrading,
        publicUrl: db.getPublicUrl(),
        logs: isAuth ? (data.logs || []).slice(0, 50) : [],
        system: {
          uptimeSeconds: process.uptime(),
          platform: os.platform(),
          freeMemMB: Math.round(os.freemem() / 1024 / 1024)
        }
      }
    })
  );

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'AUTH' && isValidToken(msg.token)) {
        ws.send(
          JSON.stringify({
            type: 'AUTH_SUCCESS',
            data: {
              trading: db.getTrading(),
              logs: (data.logs || []).slice(0, 50)
            }
          })
        );
      }
    } catch {}
  });
});

// Periodic system pulse (every 3 seconds)
setInterval(() => {
  broadcast({
    type: 'SYSTEM_PULSE',
    data: {
      uptimeSeconds: process.uptime(),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
      activeClients: wss.clients.size,
      publicUrl: db.getPublicUrl(),
      timestamp: new Date().toISOString()
    }
  });
}, 3000);

// Automatic Anti-Sleep Pulse for Cloud Deployments (Render / Koyeb)
const cloudExternalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (cloudExternalUrl) {
  console.log(`[Anti-Sleep] 24/7 Cloud Keep-Alive armed for: ${cloudExternalUrl}`);
  setInterval(async () => {
    try {
      await fetch(`${cloudExternalUrl}/api/trading/status`);
      console.log(`[Anti-Sleep] Keep-alive ping sent to ${cloudExternalUrl}`);
    } catch {}
  }, 9 * 60 * 1000); // Every 9 minutes
}

// --- AUTHENTICATION API ROUTES ---

app.post('/api/auth/verify', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập mã PIN.' });
  }

  const result = db.verifyPin(pin);
  if (result.success) {
    const token = generateAuthToken();
    return res.json({
      success: true,
      token,
      message: 'Mã PIN chính xác! Đã mở khóa trạm điều hành.',
      trading: db.getTrading(),
      config: db.getConfig()
    });
  }

  res.status(401).json(result);
});

app.post('/api/auth/change-pin', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin mã PIN.' });
  }

  const result = db.changePin(currentPin, newPin);
  res.json(result);
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : req.body.token;
  if (token) authenticatedTokens.delete(token);
  res.json({ success: true });
});

// --- REST API ROUTES (PROTECTED BY PIN TOKEN) ---

app.get('/api/trading/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : (req.headers['x-terminal-token'] || req.query.token);
  const isAuth = isValidToken(token);

  res.json({
    isAuthenticated: isAuth,
    trading: isAuth ? db.getTrading() : {
      balanceVND: '••••••',
      balanceUSD: '•••',
      realizedPnlUSD: 0,
      leverage: 3,
      activePosition: null,
      stats: { totalTrades: 0, wins: 0, losses: 0, winRate: 0 }
    },
    config: db.getConfig(),
    marketRadar: Object.values(quantEngine.marketData)
      .filter(c => c.price > 0)
      .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.volume - a.volume))
      .slice(0, 30),
    totalCoinsScanned: Object.keys(quantEngine.marketData).length,
    isAutoTrading: quantEngine.isAutoTrading,
    publicUrl: db.getPublicUrl()
  });
});

app.post('/api/trading/order', requireAuth, (req, res) => {
  const { symbol, side } = req.body;
  const targetSymbol = symbol || (quantEngine.marketData['BTCUSDT'] ? 'BTCUSDT' : Object.keys(quantEngine.marketData)[0]);
  const result = quantEngine.openPosition(targetSymbol, side, 'Manual Private Click');
  res.json(result);
});

app.post('/api/trading/close', requireAuth, (req, res) => {
  const { id, symbol, reason } = req.body || {};
  const target = id || symbol || 'ALL';
  const closeReason = reason || 'MANUAL_PANIC_CLOSE';
  const result = quantEngine.closePosition(target, closeReason);
  res.json(result);
});

app.post('/api/trading/capital', requireAuth, (req, res) => {
  const { amountVND } = req.body;
  quantEngine.setCapital(amountVND);
  res.json({ success: true, trading: db.getTrading() });
});

app.post('/api/trading/leverage', requireAuth, (req, res) => {
  const { leverage } = req.body;
  const result = quantEngine.setLeverage(leverage);
  res.json({ success: true, trading: result });
});

app.post('/api/trading/auto', requireAuth, (req, res) => {
  const { enabled } = req.body;
  quantEngine.isAutoTrading = !!enabled;
  db.addLog('INFO', 'QuantTrading', `Chế độ tự động kiếm tiền AI 24/7: ${enabled ? 'BẬT' : 'TẮT'}`);
  broadcast({
    type: 'AUTO_TRADING_CHANGED',
    data: { isAutoTrading: quantEngine.isAutoTrading }
  });
  res.json({ success: true, isAutoTrading: quantEngine.isAutoTrading });
});

app.post('/api/config', requireAuth, (req, res) => {
  const { dailyTargetUSD, monthlyTargetUSD, riskProfile } = req.body;
  const updated = db.updateConfig({
    ...(dailyTargetUSD !== undefined && { dailyTargetUSD: parseFloat(dailyTargetUSD) }),
    ...(monthlyTargetUSD !== undefined && { monthlyTargetUSD: parseFloat(monthlyTargetUSD) }),
    ...(riskProfile !== undefined && { riskProfile })
  });
  db.addLog('INFO', 'Settings', 'Đã lưu cấu hình mục tiêu kiếm tiền thụ động cá nhân.');
  broadcast({
    type: 'CONFIG_UPDATED',
    data: updated
  });
  res.json({ success: true, config: updated });
});

app.post('/api/logs/clear', requireAuth, (req, res) => {
  db.clearLogs();
  broadcast({ type: 'LOGS_CLEARED' });
  res.json({ success: true });
});

// --- CLOUDFLARE QUICK TUNNEL LAUNCHER (SECURE PRIVATE WEB ACCESS) ---
let tunnelProcess = null;

function startCloudflareTunnel(port) {
  const cloudflaredPath = path.join(__dirname, '..', 'cloudflared.exe');
  if (!fs.existsSync(cloudflaredPath)) {
    console.warn('[Tunnel] cloudflared.exe not found. Local terminal only.');
    return;
  }

  console.log('[Tunnel] Spawning Cloudflare Quick Tunnel for private mobile access...');
  db.addLog('INFO', 'Tunnel', 'Đang thiết lập cổng bảo mật Cloudflare Tunnel truy cập riêng từ điện thoại...');

  try {
    tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--config', 'NUL', '--url', `http://127.0.0.1:${port}`]);

    tunnelProcess.stderr.on('data', data => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        const publicUrl = match[0];
        console.log(`====================================================`);
        console.log(`🔐 PRIVATE PASSIVE CRYPTO TERMINAL URL: ${publicUrl}`);
        console.log(`====================================================`);
        db.setPublicUrl(publicUrl);
        db.addLog('SUCCESS', 'Tunnel', `Cổng truy cập riêng đã online tại: ${publicUrl}`);
        broadcast({
          type: 'PUBLIC_URL_READY',
          data: { publicUrl }
        });
      }
    });

    tunnelProcess.on('error', err => {
      console.error('[Tunnel Error]', err.message);
    });

    tunnelProcess.on('exit', code => {
      console.warn('[Tunnel] Process exited with code', code);
    });
  } catch (err) {
    console.error('[Tunnel Launch Failed]', err.message);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🐩 POODLE QUANT // PERSONAL AUTONOMOUS CRYPTO TERMINAL`);
  console.log(`👑 Private Dashboard: http://localhost:${PORT}`);
  console.log(`🛡️ Multi-Layer Security Shield: ACTIVE (PIN Protected)`);
  console.log(`====================================================`);
  
  quantEngine.start();
  startCloudflareTunnel(PORT);
});
