const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, '..', 'data', 'knowledge_base');
const FRAMEWORKS_FILE = path.join(KB_DIR, 'causal_frameworks.json');

class ContextRetriever {
  constructor() {
    this.frameworks = { pillars: [], rules: [] };
    this.markdownDocs = {};
    this.chunks = [];
    this.loadKnowledgeBase();
  }

  loadKnowledgeBase() {
    try {
      if (fs.existsSync(FRAMEWORKS_FILE)) {
        const raw = fs.readFileSync(FRAMEWORKS_FILE, 'utf-8');
        this.frameworks = JSON.parse(raw);
      }

      // Load and chunk Markdown documents for RAG retrieval
      if (Array.isArray(this.frameworks.pillars)) {
        for (const p of this.frameworks.pillars) {
          const mdPath = path.join(KB_DIR, p.docFile);
          if (fs.existsSync(mdPath)) {
            const content = fs.readFileSync(mdPath, 'utf-8');
            this.markdownDocs[p.id] = content;
            this._indexMarkdownChunks(p.id, p.name, p.docFile, content);
          }
        }
      }
      console.log(
        `[ContextRetriever] Đã nạp Knowledge Base: ${this.frameworks.pillars.length} Trụ cột, ${this.frameworks.rules.length} Quy tắc nhân quả, ${this.chunks.length} phân đoạn RAG.`
      );
    } catch (err) {
      console.error('[ContextRetriever] Lỗi nạp Knowledge Base:', err.message);
    }
  }

  _indexMarkdownChunks(pillarId, pillarName, docFile, content) {
    const sections = content.split(/\n(?=### |## )/g);
    sections.forEach((sec, idx) => {
      const clean = sec.trim();
      if (!clean) return;
      const firstLine = clean.split('\n')[0].replace(/^#+\s*/, '').trim();
      this.chunks.push({
        id: `${pillarId}-DOC-${idx + 1}`,
        pillar: pillarId,
        pillarName,
        docFile,
        heading: firstLine,
        content: clean,
        searchText: `${pillarName} ${firstLine} ${clean}`.toLowerCase()
      });
    });
  }

  getKnowledgeSummary() {
    return {
      version: this.frameworks.version || '2.0.0',
      updatedAt: this.frameworks.updatedAt,
      description: this.frameworks.description,
      totalPillars: (this.frameworks.pillars || []).length,
      totalRules: (this.frameworks.rules || []).length,
      totalRagChunks: this.chunks.length,
      pillars: (this.frameworks.pillars || []).map(p => ({
        ...p,
        ruleCount: (this.frameworks.rules || []).filter(r => r.pillar === p.id).length,
        markdownPreview: (this.markdownDocs[p.id] || '').slice(0, 600) + '...'
      })),
      rules: this.frameworks.rules || []
    };
  }

  getMarkdownDocument(pillarId) {
    return this.markdownDocs[pillarId] || '';
  }

  // --- SEMANTIC / KEYWORD RAG SEARCH ACROSS CAUSAL RULES & MARKDOWN CHUNKS ---
  searchKnowledgeBase(query = '', pillarFilter = 'ALL') {
    const cleanQuery = String(query || '').trim().toLowerCase();
    const terms = cleanQuery.split(/\s+/).filter(Boolean);

    let candidateRules = this.frameworks.rules || [];
    if (pillarFilter && pillarFilter !== 'ALL') {
      candidateRules = candidateRules.filter(r => r.pillar === pillarFilter);
    }

    const scoredRules = candidateRules.map(rule => {
      let score = 10;
      if (terms.length > 0) {
        score = 0;
        const haystack = [
          rule.id,
          rule.title,
          rule.pillarName,
          rule.direction,
          ...(rule.tags || []),
          rule.causalChain.marketContext,
          rule.causalChain.dataSignals,
          rule.causalChain.mmBehavior,
          rule.causalChain.actionPlan
        ]
          .join(' ')
          .toLowerCase();

        for (const t of terms) {
          if (rule.title.toLowerCase().includes(t)) score += 25;
          if ((rule.tags || []).some(tag => tag.toLowerCase().includes(t))) score += 20;
          if (haystack.includes(t)) score += 10;
        }
      }
      return { ...rule, matchScore: score };
    });

    const matchedRules = scoredRules
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    // Also search Markdown chunks
    let candidateChunks = this.chunks;
    if (pillarFilter && pillarFilter !== 'ALL') {
      candidateChunks = candidateChunks.filter(c => c.pillar === pillarFilter);
    }

    const matchedChunks = candidateChunks
      .map(chunk => {
        let score = terms.length === 0 ? 5 : 0;
        for (const t of terms) {
          if (chunk.heading.toLowerCase().includes(t)) score += 20;
          if (chunk.searchText.includes(t)) score += 8;
        }
        return { ...chunk, matchScore: score };
      })
      .filter(c => c.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);

    return {
      query: cleanQuery,
      pillarFilter,
      rules: matchedRules,
      markdownChunks: matchedChunks
    };
  }

  // --- QUANTITATIVE DERIVATIVES, SMC, WYCKOFF/VSA & KELLY/ATR CAUSAL RETRIEVER ---
  retrieveByMarketState(coinSnapshot = {}, tradingConfig = {}) {
    const symbol = coinSnapshot.symbol || 'BTCUSDT';
    const price = parseFloat(coinSnapshot.price) || 100;
    const high24h = parseFloat(coinSnapshot.high24h) || price * 1.02;
    const low24h = parseFloat(coinSnapshot.low24h) || price * 0.98;
    const change24h = parseFloat(coinSnapshot.change24h) || 0;
    const volume = parseFloat(coinSnapshot.volume) || 5000000;
    const rsi = parseFloat(coinSnapshot.rsi) || 50;
    const ema9 = parseFloat(coinSnapshot.ema9) || price;
    const ema21 = parseFloat(coinSnapshot.ema21) || price;

    // 1. Derive Price Range Position (Discount vs Premium) & Volatility (ATR Estimate)
    const range24h = Math.max(high24h - low24h, price * 0.005);
    const rangePositionPct = Math.min(100, Math.max(0, Math.round(((price - low24h) / range24h) * 100)));
    const priceZone = rangePositionPct <= 35
      ? 'DISCOUNT (Vùng Chiết Khấu < 35%)'
      : (rangePositionPct >= 65 ? 'PREMIUM (Vùng Giá Đắt > 65%)' : 'EQUILIBRIUM (Vùng Cân Bằng 35%-65%)');

    // Estimate 14-period intraday ATR% from 24h range & tick volatility
    const rawAtrPct = coinSnapshot.atrPct || Math.max(0.45, Math.min(2.5, (range24h / price) * 100 * 0.22));
    const atrPct = parseFloat(rawAtrPct.toFixed(3));
    const atrValue = parseFloat(((price * atrPct) / 100).toFixed(price < 1 ? 5 : 2));

    // 2. Infer SMC Price Action Structure (BOS / CHoCH / Liquidity Sweep / OB+FVG)
    let smcState = {
      structure: 'RANGING_CONSOLIDATION',
      label: 'Tích lũy trong biên độ (Chờ quét thanh khoản)',
      poiZone: 'Mid-Range Equilibrium',
      bias: 'NEUTRAL'
    };

    if (rsi <= 28 || (rangePositionPct <= 22 && change24h > -8)) {
      smcState = {
        structure: 'BULLISH_SWEEP_CHOCH',
        label: 'Quét thanh khoản đáy (Sell-Side Liquidity Sweep) + Bullish CHoCH tại Demand OB/FVG',
        poiZone: `Bullish Order Block & FVG ($${(low24h * 1.002).toFixed(price < 1 ? 4 : 2)} - $${(low24h + range24h * 0.18).toFixed(price < 1 ? 4 : 2)})`,
        bias: 'LONG'
      };
    } else if (rsi >= 72 || (rangePositionPct >= 78 && change24h < 8)) {
      smcState = {
        structure: 'BEARISH_SWEEP_CHOCH',
        label: 'Quét thanh khoản đỉnh (Buy-Side Liquidity Sweep) + Bearish CHoCH tại Supply OB/FVG',
        poiZone: `Bearish Supply OB & FVG ($${(high24h - range24h * 0.18).toFixed(price < 1 ? 4 : 2)} - $${(high24h * 0.998).toFixed(price < 1 ? 4 : 2)})`,
        bias: 'SHORT'
      };
    } else if (ema9 > ema21 && rsi <= 46 && change24h >= 0.5) {
      smcState = {
        structure: 'BULLISH_BOS_IDM',
        label: 'Bullish BOS + Quét Inducement (IDM) hồi về vùng OTE / Bullish FVG',
        poiZone: `Discount Pullback OTE ($${(price * 0.995).toFixed(price < 1 ? 4 : 2)})`,
        bias: 'LONG'
      };
    } else if (ema9 < ema21 && rsi >= 54 && change24h <= -0.5) {
      smcState = {
        structure: 'BEARISH_BOS_IDM',
        label: 'Bearish BOS + Quét Inducement (IDM) hồi lên vùng Bearish FVG',
        poiZone: `Premium Pullback OTE ($${(price * 1.005).toFixed(price < 1 ? 4 : 2)})`,
        bias: 'SHORT'
      };
    } else if (Math.abs(change24h) >= 4.5) {
      smcState = {
        structure: change24h > 0 ? 'BULLISH_DISPLACEMENT_BOS' : 'BEARISH_DISPLACEMENT_BOS',
        label: change24h > 0
          ? 'Nến đẩy xung lực (Bullish Displacement) phá vỡ cấu trúc BOS kèm FVG mở rộng'
          : 'Nến xả xung lực (Bearish Displacement) phá vỡ cấu trúc BOS giảm',
        poiZone: `Imbalance FVG Zone ($${price.toFixed(price < 1 ? 4 : 2)})`,
        bias: change24h > 0 ? 'LONG' : 'SHORT'
      };
    }

    // 3. Infer Derivatives Telemetry (OI, Funding Rate, CVD, Liquidation Heatmap)
    const fundingRateEst = parseFloat((((rsi - 50) * 0.0009) + (change24h * 0.0012)).toFixed(4));
    const lsRatioEst = parseFloat((1.0 + ((rsi - 50) / 45)).toFixed(2));
    let derivativesState = {
      fundingRatePct: `${fundingRateEst >= 0 ? '+' : ''}${fundingRateEst.toFixed(4)}%/8h`,
      longShortRatio: lsRatioEst,
      oiRegime: 'OI Ổn định / Dòng tiền cân bằng',
      cvdStatus: 'CVD đồng thuận theo giá',
      heatmapMagnet: `Bản đồ thanh lý cân bằng quanh $${low24h.toFixed(price < 1 ? 4 : 2)} và $${high24h.toFixed(price < 1 ? 4 : 2)}`
    };

    if (rsi <= 26) {
      derivativesState.oiRegime = 'OI Sụt giảm mạnh (Long Capitulation Flush hoàn tất) -> Sẵn sàng đảo chiều tăng';
      derivativesState.cvdStatus = 'Bullish CVD Absorption (Lực bán tháo bị tường Limit Buy của MM hấp thụ hết)';
      derivativesState.heatmapMagnet = `Cụm thanh lý Short (Short Liquidation Cluster) dày đặc phía trên vùng $${(price * 1.015).toFixed(price < 1 ? 4 : 2)}`;
    } else if (rsi <= 38) {
      derivativesState.oiRegime = 'OI Tăng tại hỗ trợ + Funding âm (Đám đông đang đuổi Short ở đáy)';
      derivativesState.cvdStatus = 'Phân kỳ dương CVD (Aggressive Sellers kiệt sức, MM đang gom Long)';
      derivativesState.heatmapMagnet = `Nam châm hút giá (Liquidity Magnet) nằm tại cụm thanh lý Short $${(price * 1.012).toFixed(price < 1 ? 4 : 2)}`;
    } else if (rsi >= 74) {
      derivativesState.oiRegime = 'OI Tăng nóng đỉnh điểm + Funding dương cao (Bẫy Crowded Long)';
      derivativesState.cvdStatus = 'Bearish CVD Divergence (Đám đông Market Buy nhưng bị tường Limit Sell của MM chặn đứng)';
      derivativesState.heatmapMagnet = `Cụm thanh lý Long (Long Liquidation Cluster) dày đặc ngay dưới $${(price * 0.985).toFixed(price < 1 ? 4 : 2)}`;
    } else if (rsi >= 58 && change24h < -1.0) {
      derivativesState.oiRegime = 'OI Tăng khi giá giảm (Dòng tiền lớn đang mở vị thế Short chủ động)';
      derivativesState.cvdStatus = 'CVD âm chủ động (Taker Sell áp đảo)';
      derivativesState.heatmapMagnet = `Hút về cụm thanh lý đáy 24h tại $${low24h.toFixed(price < 1 ? 4 : 2)}`;
    } else if (rsi <= 44 && change24h > 1.0) {
      derivativesState.oiRegime = 'OI Tăng cùng giá (Dòng tiền mới mở Long thuận xu hướng)';
      derivativesState.cvdStatus = 'CVD dương mạnh (Taker Buy chủ động hấp thụ nhịp chỉnh)';
      derivativesState.heatmapMagnet = `Hút về cụm thanh lý đỉnh 24h tại $${high24h.toFixed(price < 1 ? 4 : 2)}`;
    }

    // 4. Infer Wyckoff Phase & Volume Spread Analysis (VSA Effort vs Result)
    let wyckoffVsaState = {
      phase: 'Phase B (Dao động kiểm định Cung - Cầu trong Trading Range)',
      vsaSignature: 'Spread và Volume ở mức cân bằng',
      compositeManIntent: 'Composite Man đang quan sát phản ứng tại 2 biên thanh khoản.'
    };

    if (rsi <= 32) {
      wyckoffVsaState = {
        phase: 'Wyckoff Accumulation Phase C (Spring / Terminal Shakeout)',
        vsaSignature: 'Stopping Volume (Nỗ lực bán lớn nhưng biên độ thu hẹp rút chân) + No Supply Test',
        compositeManIntent: 'Composite Man đã vét sạch nguồn cung bán tháo của đám đông ở dưới hỗ trợ để chuẩn bị đánh thốc vào Pha D (Sign of Strength - SOS).'
      };
    } else if (rsi >= 70) {
      wyckoffVsaState = {
        phase: 'Wyckoff Distribution Phase C (UTAD - Upthrust After Distribution)',
        vsaSignature: 'Effort to Rise Without Result (Volume cao trên đỉnh nhưng nến đóng cửa yếu) + No Demand',
        compositeManIntent: 'Composite Man tạo bẫy tăng giá giả (UTAD) để xả nốt kho hàng Long cho đám đông FOMO và chất lệnh Short trước Pha E (Markdown).'
      };
    } else if (smcState.bias === 'LONG') {
      wyckoffVsaState = {
        phase: 'Wyckoff Accumulation Phase D (Sign of Strength - SOS & Last Point of Support - LPS)',
        vsaSignature: 'Wide Spread Up-Bars kèm Volume tăng trên nhịp đẩy, Volume cạn kiệt trên nhịp chỉnh (No Supply)',
        compositeManIntent: 'Composite Man đang đẩy giá bước vào sóng Markup, đỡ giá quyết liệt tại vùng hỗ trợ LPS.'
      };
    } else if (smcState.bias === 'SHORT') {
      wyckoffVsaState = {
        phase: 'Wyckoff Distribution Phase D (Sign of Weakness - SOW & Last Point of Supply - LPSY)',
        vsaSignature: 'Wide Spread Down-Bars phá hỗ trợ kèm nhịp hồi No Demand (Volume thấp, Spread hẹp)',
        compositeManIntent: 'Composite Man đã rút hoàn toàn lệnh đỡ giá và đang đè bán tại mọi nhịp hồi lên LPSY.'
      };
    }

    // 5. Match Causal Rules from Knowledge Base
    const rules = this.frameworks.rules || [];
    let primaryRule = rules[0];
    const matchedRules = [];

    if (rsi <= 26) {
      primaryRule = rules.find(r => r.id === 'DERIV-03') || rules[0];
      matchedRules.push(
        rules.find(r => r.id === 'DERIV-03'),
        rules.find(r => r.id === 'SMC-01'),
        rules.find(r => r.id === 'WYK-01'),
        rules.find(r => r.id === 'RISK-01')
      );
    } else if (rsi <= 38) {
      primaryRule = rules.find(r => r.id === 'SMC-01') || rules[0];
      matchedRules.push(
        rules.find(r => r.id === 'SMC-01'),
        rules.find(r => r.id === 'WYK-01'),
        rules.find(r => r.id === 'DERIV-02'),
        rules.find(r => r.id === 'RISK-01')
      );
    } else if (rsi >= 72) {
      primaryRule = rules.find(r => r.id === 'SMC-02') || rules[1];
      matchedRules.push(
        rules.find(r => r.id === 'SMC-02'),
        rules.find(r => r.id === 'DERIV-01'),
        rules.find(r => r.id === 'WYK-02'),
        rules.find(r => r.id === 'RISK-01')
      );
    } else {
      primaryRule = rules.find(r => r.id === 'SMC-03') || rules[2];
      matchedRules.push(
        rules.find(r => r.id === 'SMC-03'),
        rules.find(r => r.id === (smcState.bias === 'SHORT' ? 'WYK-02' : 'WYK-01')),
        rules.find(r => r.id === 'RISK-01')
      );
    }

    const validConfluence = matchedRules.filter(Boolean);

    // 6. Compute Pillar 4: Kelly Criterion + ATR Stop Loss & Position Sizing
    const balanceUSD = parseFloat(tradingConfig.balanceUSD) || 19.68;
    const leverage = parseInt(tradingConfig.leverage, 10) || 3;
    const opportunityScore = parseInt(coinSnapshot.opportunityScore, 10) || 75;

    // Estimate Win Probability W from AI Confluence Score (bounded [0.52, 0.72])
    const winRateW = parseFloat(Math.min(0.72, Math.max(0.52, 0.35 + (opportunityScore / 100) * 0.35)).toFixed(2));
    const targetRR = primaryRule && primaryRule.sizingModel ? primaryRule.sizingModel.targetRR : 1.8;
    const atrMultiplier = primaryRule && primaryRule.sizingModel ? primaryRule.sizingModel.atrSlMultiplier : 1.5;

    // Kelly Formula: f* = W - (1 - W) / R
    const fullKelly = Math.max(0, winRateW - (1 - winRateW) / targetRR);
    const quarterKelly = fullKelly * 0.25; // Safe Fractional Kelly (0.25x)
    // Cap margin allocation per position at 18% of account balance
    const allocatedMarginRatio = parseFloat(Math.min(0.18, Math.max(0.08, quarterKelly * 1.6)).toFixed(3));
    const marginUSD = parseFloat((balanceUSD * allocatedMarginRatio).toFixed(2));
    const notionalSizeUSD = parseFloat((marginUSD * leverage).toFixed(2));

    // ATR-based Stop Loss & Take Profit Distances (clamped for safe futures execution)
    const slDistancePct = parseFloat(Math.min(1.5, Math.max(0.65, atrPct * atrMultiplier)).toFixed(2));
    const tpDistancePct = parseFloat((slDistancePct * targetRR).toFixed(2));

    const recommendedSide = smcState.bias === 'SHORT' || (primaryRule && primaryRule.direction === 'SHORT') ? 'SHORT' : 'LONG';
    const slPrice = recommendedSide === 'LONG'
      ? parseFloat((price * (1 - slDistancePct / 100)).toFixed(price < 1 ? 4 : 2))
      : parseFloat((price * (1 + slDistancePct / 100)).toFixed(price < 1 ? 4 : 2));
    const tpPrice = recommendedSide === 'LONG'
      ? parseFloat((price * (1 + tpDistancePct / 100)).toFixed(price < 1 ? 4 : 2))
      : parseFloat((price * (1 - tpDistancePct / 100)).toFixed(price < 1 ? 4 : 2));

    const maxLossUSD = parseFloat(((notionalSizeUSD * slDistancePct) / 100).toFixed(3));
    const expectedProfitUSD = parseFloat(((notionalSizeUSD * tpDistancePct) / 100).toFixed(3));

    // 7. Build Causal Reasoning Synthesis (Bối cảnh -> Dấu hiệu dữ liệu -> Hành vi Cá mập -> Kịch bản hành động)
    const causalSynthesis = {
      symbol,
      recommendedSide,
      confidenceScore: opportunityScore,
      primaryRuleId: primaryRule ? primaryRule.id : 'SMC-01',
      primaryRuleTitle: primaryRule ? primaryRule.title : 'Multi-Pillar Institutional Confluence',
      marketContext: `[${symbol} @ $${price.toLocaleString('en-US')}] Giá đang ở vị trí ${rangePositionPct}% biên độ 24h (${priceZone}), biến động 24h ${change24h >= 0 ? '+' : ''}${change24h}%, RSI(14) = ${rsi}. Cấu trúc Wyckoff: ${wyckoffVsaState.phase}.`,
      dataSignals: `• SMC: ${smcState.label} tại ${smcState.poiZone}.\n• Phái sinh (OI/CVD/Funding): ${derivativesState.oiRegime} | Funding ước tính: ${derivativesState.fundingRatePct} (L/S Ratio: ${derivativesState.longShortRatio}) | ${derivativesState.cvdStatus}.\n• VSA: ${wyckoffVsaState.vsaSignature}.`,
      mmBehavior: `${primaryRule ? primaryRule.causalChain.mmBehavior : ''} ${wyckoffVsaState.compositeManIntent} Điểm hút thanh lý: ${derivativesState.heatmapMagnet}.`,
      actionPlan: `Kích hoạt kịch bản [${recommendedSide} ${symbol}] theo quy tắc ${primaryRule ? primaryRule.id : 'SMC-01'}: Vào lệnh quanh $${price.toLocaleString('en-US')} | Cắt lỗ chuẩn ATR (${atrMultiplier}×ATR = -${slDistancePct}%): $${slPrice} | Chốt lời mục tiêu (R:R 1:${targetRR} = +${tpDistancePct}%): $${tpPrice}. Ký quỹ Fractional Kelly: $${marginUSD} (${(allocatedMarginRatio * 100).toFixed(1)}% vốn, Đòn bẩy x${leverage}). Tự động dời SL về Hòa vốn khi lãi đạt +0.30%.`
    };

    const riskSizing = {
      winRateEstPct: Math.round(winRateW * 100),
      rewardRiskRatio: targetRR,
      fullKellyPct: parseFloat((fullKelly * 100).toFixed(1)),
      quarterKellyPct: parseFloat((quarterKelly * 100).toFixed(2)),
      allocatedMarginPct: parseFloat((allocatedMarginRatio * 100).toFixed(1)),
      marginUSD,
      notionalSizeUSD,
      leverage,
      atrValue,
      atrPct,
      atrMultiplier,
      slDistancePct,
      tpDistancePct,
      recommendedSL: slPrice,
      recommendedTP: tpPrice,
      maxRiskUSD: maxLossUSD,
      expectedRewardUSD: expectedProfitUSD
    };

    // 8. Generate Structured LLM Prompt Context (Markdown format for AI Agent / RAG injection)
    const llmPromptContext = [
      `### [RAG CONTEXT RETRIEVED FOR ${symbol} | SCORE: ${opportunityScore}/100 | SIDE: ${recommendedSide}]`,
      `- **1. Bối cảnh thị trường (Market Context):** ${causalSynthesis.marketContext}`,
      `- **2. Dấu hiệu dữ liệu 4 Trụ cột (Data Signals):**\n${causalSynthesis.dataSignals}`,
      `- **3. Hành vi của Cá mập / Market Maker (MM Behavior):** ${causalSynthesis.mmBehavior}`,
      `- **4. Kịch bản hành động & Quản trị rủi ro Kelly/ATR (Action Plan):** ${causalSynthesis.actionPlan}`,
      `- **5. Quy tắc chuẩn hóa được kích hoạt:** ${validConfluence.map(r => `[${r.id}] ${r.title}`).join(' + ')}`
    ].join('\n');

    return {
      symbol,
      timestamp: new Date().toISOString(),
      recommendedSide,
      smcState,
      derivativesState,
      wyckoffVsaState,
      riskSizing,
      primaryRule,
      confluenceRules: validConfluence,
      causalSynthesis,
      llmPromptContext
    };
  }
}

module.exports = new ContextRetriever();

