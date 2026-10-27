const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Broadcast to all connected clients
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

// WebSocket connection handling
wss.on('connection', ws => {
  const data = db.load();
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      data: {
        trading: db.getTrading(),
        config: db.getConfig(),
        marketRadar: Object.values(quantEngine.marketData),
        isAutoTrading: quantEngine.isAutoTrading,
        publicUrl: db.getPublicUrl(),
        logs: (data.logs || []).slice(0, 50),
        system: {
          uptimeSeconds: process.uptime(),
          platform: os.platform(),
          freeMemMB: Math.round(os.freemem() / 1024 / 1024)
        }
      }
    })
  );
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

// --- REST API ROUTES (PRIVATE TERMINAL ONLY) ---

app.get('/api/trading/status', (req, res) => {
  res.json({
    trading: db.getTrading(),
    config: db.getConfig(),
    marketRadar: Object.values(quantEngine.marketData),
    isAutoTrading: quantEngine.isAutoTrading,
    publicUrl: db.getPublicUrl()
  });
});

app.post('/api/trading/order', (req, res) => {
  const { symbol, side } = req.body;
  const targetSymbol = symbol || (quantEngine.marketData['BTCUSDT'] ? 'BTCUSDT' : Object.keys(quantEngine.marketData)[0]);
  const result = quantEngine.openPosition(targetSymbol, side, 'Manual Private Click');
  res.json(result);
});

app.post('/api/trading/close', (req, res) => {
  const result = quantEngine.closePosition('MANUAL_PANIC_CLOSE');
  res.json(result);
});

app.post('/api/trading/capital', (req, res) => {
  const { amountVND } = req.body;
  quantEngine.setCapital(amountVND);
  res.json({ success: true, trading: db.getTrading() });
});

app.post('/api/trading/leverage', (req, res) => {
  const { leverage } = req.body;
  const result = quantEngine.setLeverage(leverage);
  res.json({ success: true, trading: result });
});

app.post('/api/trading/auto', (req, res) => {
  const { enabled } = req.body;
  quantEngine.isAutoTrading = !!enabled;
  db.addLog('INFO', 'QuantTrading', `Chế độ tự động kiếm tiền AI 24/7: ${enabled ? 'BẬT' : 'TẮT'}`);
  broadcast({
    type: 'AUTO_TRADING_CHANGED',
    data: { isAutoTrading: quantEngine.isAutoTrading }
  });
  res.json({ success: true, isAutoTrading: quantEngine.isAutoTrading });
});

app.post('/api/config', (req, res) => {
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

app.post('/api/logs/clear', (req, res) => {
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
  console.log(`💎 VIBE-QUANT // PERSONAL AUTONOMOUS CRYPTO TERMINAL`);
  console.log(`👑 Private Dashboard: http://localhost:${PORT}`);
  console.log(`====================================================`);
  
  quantEngine.start();
  startCloudflareTunnel(PORT);
});
