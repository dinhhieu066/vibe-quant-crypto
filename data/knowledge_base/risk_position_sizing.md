# PILLAR 4: RISK MANAGEMENT & POSITION SIZING CAUSAL FRAMEWORK (KELLY CRITERION, ATR STOPS & LEVERAGE ISOLATION)

## 1. Toán Học Quản Trị Vốn Cho Crypto Futures Đòn Bẩy
Trong giao dịch Crypto Futures, **95% nguyên nhân cháy tài khoản** không đến từ việc đoán sai xu hướng mà đến từ việc **đặt khối lượng lệnh (Position Size) sai lệch so với độ biến động (Volatility)** và hiểu sai bản chất của Đòn bẩy (Leverage). Hệ thống áp dụng 3 trụ cột toán học chuẩn Quantitative Finance:

### A. Công Thức Kelly Criterion & Fractional Kelly (Phân Bổ Vốn Tối Ưu)
Công thức Kelly gốc tính tỷ lệ vốn tối ưu $f^*$ cho mỗi lệnh nhằm tối đa hóa tốc độ tăng trưởng lãi kép dài hạn:
$$f^* = W - \frac{1 - W}{R}$$
Trong đó:
- $W$: Xác suất thắng lịch sử hoặc xác suất ước lượng của Setup hiện tại (`Win Rate`, ví dụ `0.58` tức `58%`).
- $R$: Tỷ lệ Lợi nhuận trung bình / Rủi ro trung bình (`Reward:Risk Ratio`, ví dụ `R = 1.8`).

**Quy tắc Sống Còn trong Crypto (Fractional Kelly $\alpha$):**
Do phân phối lợi suất của Crypto có đuôi béo (Fat-tail Risk / Flash Crash), sử dụng Full Kelly ($1.0 \times f^*$) sẽ dẫn đến sụt giảm vốn (Drawdown) quá lớn. Hệ thống bắt buộc nhân với hệ số an toàn **Quarter-Kelly ($\alpha = 0.25$)** và khóa trần rủi ro thực tế mỗi lệnh:
$$f_{\text{safe}} = \min\left(f_{\max}, \; 0.25 \times \left(W - \frac{1 - W}{R}\right)\right)$$
- Với tài khoản cá nhân / Scalping bảo toàn vốn: Rủi ro mất mát tối đa trên tổng tài khoản cho 1 lệnh khi chạm Stop Loss nằm trong biên `0.5% - 2.0%` tổng vốn, và ký quỹ phân bổ mỗi lệnh tối đa `18%` tổng số dư (Tối đa 3 vị thế đồng thời = `54%` vốn ký quỹ, luôn giữ `46%` tiền mặt dự phòng).

### B. Cách Tính Stop Loss Động Dựa Trên ATR (Average True Range)
Đặt Stop Loss cố định theo phần trăm cứng mà bỏ qua độ biến động hiện tại sẽ khiến lệnh dễ bị quét râu oan (Stop-hunt) khi thị trường biến động mạnh, hoặc quá rộng khi thị trường đi ngang:
$$\text{True Range (TR)}_t = \max\left(H_t - L_t, \; |H_t - C_{t-1}|, \; |L_t - C_{t-1}|\right)$$
$$\text{ATR}_{14} = \text{EMA}_{14}(\text{TR})$$

**Công thức Khoảng cách Stop Loss & Take Profit chuẩn ATR:**
$$\text{SL Distance} = k_{\text{SL}} \times \text{ATR}_{14} \quad \left(\text{với } k_{\text{SL}} \in [1.5, 2.5]\right)$$
$$\text{TP Distance} = R_{\text{target}} \times \text{SL Distance} \quad \left(\text{với } R_{\text{target}} \in [1.5, 3.0]\right)$$
- **Lệnh LONG:** $\text{SL} = \text{Entry} - k_{\text{SL}} \cdot \text{ATR}_{14}$, $\quad \text{TP} = \text{Entry} + R_{\text{target}} \cdot k_{\text{SL}} \cdot \text{ATR}_{14}$
- **Lệnh SHORT:** $\text{SL} = \text{Entry} + k_{\text{SL}} \cdot \text{ATR}_{14}$, $\quad \text{TP} = \text{Entry} - R_{\text{target}} \cdot k_{\text{SL}} \cdot \text{ATR}_{14}$

### C. Cô Lập Rủi Ro Khỏi Đòn Bẩy (Leverage Isolation Rule)
Đòn bẩy ($L$) chỉ quyết định số tiền Ký quỹ (Margin) cần khóa trên sàn, **không được phép làm thay đổi số tiền tối đa chấp nhận mất ($\text{Risk}_{\text{USD}}$)**:
$$\text{Notional Position Size (USD)} = \frac{\text{Account Balance} \times f_{\text{safe}}}{\text{SL Distance \%}}$$
$$\text{Required Margin (USD)} = \frac{\text{Notional Position Size (USD)}}{\text{Leverage } (L)}$$
- **Điều kiện chống Thanh lý cưỡng bức (Anti-Liquidation Guard):** Khoảng cách Stop Loss ($\text{SL Distance \%}$) phải luôn nhỏ hơn tối thiểu **3 lần** khoảng cách thanh lý của đòn bẩy ($\frac{100\%}{L}$). Với đòn bẩy `x3 - x5`, điểm thanh lý cách xa `20% - 33%`, trong khi SL chỉ cách `0.8% - 2.0%`, đảm bảo **0% khả năng cháy tài khoản**.

---

## 2. Khung Suy Luận Nhân Quả (Causal Reasoning Rules)

### RULE RISK-01: Volatility Expansion Regime Filter (Biến Động ATR Dãn Rộng -> Giảm Size & Nới SL)
- **Bối cảnh thị trường (Market Context):** Thị trường vừa có biến động mạnh, chỉ số $\text{ATR}\%$ vượt ngưỡng `> 3.5%` (hoặc biên độ 24h dao động `> 8%`).
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Tỷ lệ $\text{ATR}_{14} / \text{Price}$ tăng gấp đôi so với mức trung bình.
  2. Râu nến hai đầu xuất hiện liên tục (High Whip-saw Risk).
- **Hành vi của Cá mập (MM Behavior):** MM nới rộng Spread trên Order Book và liên tục quét râu 2 đầu để tiêu diệt các lệnh đặt Stop Loss quá sát (`< 0.5%`) hoặc dùng đòn bẩy cao (`> x10`).
- **Kịch bản hành động (Action Plan):**
  - **Điều chỉnh SL:** Nâng hệ số nhân ATR lên $k_{\text{SL}} = 2.0 \times \text{ATR}$ để đặt SL nằm ngoài vùng nhiễu quét râu của MM.
  - **Điều chỉnh Khối lượng (Position Sizing):** Tự động giảm khối lượng hợp đồng theo tỷ lệ nghịch với độ dãn của ATR để giữ nguyên mức rủi ro USD tuyệt đối ($\text{Risk}_{\text{USD}}$ không đổi). Giữ đòn bẩy ở mức an toàn `x1 - x3`.

### RULE RISK-02: Dynamic Breakeven & Trailing Profit Lock (Khóa Hòa Vốn & Bảo Toàn Lãi Kép)
- **Bối cảnh thị trường (Market Context):** Vị thế Futures đã được mở và giá đang di chuyển đúng hướng dự kiến của mô hình SMC / Wyckoff.
- **Dấu hiệu dữ liệu (Data Signals):**
  1. **Mốc 1 (+0.30% đến +0.5R):** Giá đã thoát khỏi vùng Entry và tạo cấu trúc nến đẩy thuận chiều.
  2. **Mốc 2 (+0.70% đến +1.0R):** Giá tiệm cận vùng cản nội tại đầu tiên (Internal Liquidity).
- **Hành vi của Cá mập (MM Behavior):** Tại các vùng cản nội tại, MM thường tạo các nhịp giật ngược (Pullback / Inducement) để rũ bỏ các vị thế yếu hoặc đảo chiều nếu lực mua yếu.
- **Kịch bản hành động (Action Plan):**
  - **Tại Mốc 1:** Lập tức dời Stop Loss về **Giá vào lệnh (Breakeven + phí sàn)**, đưa rủi ro của lệnh về **0% (Free-Ride Trade)**.
  - **Tại Mốc 2:** Dời Stop Loss lên khóa chắc chắn tối thiểu **50% lợi nhuận tạm tính (Profit Lock)**, để phần còn lại gồng tới mục tiêu Take Profit chuẩn $R:R \ge 1.5 - 2.5$.

### RULE RISK-03: Negative Expectancy & Fee-Drag Veto (Bộ Lọc Từ Chối Kèo Có Kỳ Vọng Toán Học Âm)
- **Bối cảnh thị trường (Market Context):** Có tín hiệu giao dịch xuất hiện nhưng biên độ lợi nhuận tiềm năng đến vùng kháng cự/hỗ trợ tiếp theo quá hẹp.
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Tỷ lệ $R:R$ thực tế (sau khi trừ phí Taker `0.05% × 2` và Funding Rate) nhỏ hơn `1.3`.
  2. Hoặc giá trị **Kelly Criterion** $f^* = W - \frac{1-W}{R} \le 0$.
- **Hành vi của Cá mập (MM Behavior):** Giam giá trong biên độ nhiễu hẹp (Chop Zone) để bào mòn phí giao dịch và phí Funding của các trader giao dịch quá mức (Overtrading).
- **Kịch bản hành động (Action Plan):**
  - **Hành động:** Kích hoạt quyền phủ quyết (**VETO / NO-TRADE**). Không mở vị thế cho đến khi giá quét biên tạo không gian biên độ đủ đáp ứng $R:R \ge 1.5$ và $f^* > 0$.

