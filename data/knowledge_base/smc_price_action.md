# PILLAR 1: SMART MONEY CONCEPTS (SMC) & PRICE ACTION CAUSAL FRAMEWORK

## 1. Bản chất Cấu trúc Thị trường & Thanh khoản trong Crypto Futures
Trong thị trường Crypto Futures đòn bẩy cao, giá không di chuyển ngẫu nhiên mà vận hành theo thuật toán tìm kiếm thanh khoản (Liquidity Seeking Algorithm). Market Makers (MM) và các quỹ định lượng (Smart Money) cần lượng đối ứng khổng lồ để khớp lệnh mà không gây trượt giá (slippage). Do đó, vùng đặt Stop-Loss (SL) và vùng giá Thanh lý (Liquidation Price) của đám đông Retail chính là nguồn thanh khoản mục tiêu.

### Các khái niệm cốt lõi đã chuẩn hóa:
- **BOS (Break of Structure):** Phá vỡ đỉnh cao hơn (Higher High - HH) trong xu hướng tăng hoặc đáy thấp hơn (Lower Low - LL) trong xu hướng giảm bằng **thân nến đóng cửa (Body Close)**, xác nhận dòng tiền tổ chức tiếp tục duy trì xu hướng.
- **CHoCH (Change of Character):** Dấu hiệu đảo chiều cấu trúc đầu tiên khi giá phá vỡ đỉnh/đáy cấu trúc nội tại gần nhất (Internal Swing High/Low) ngược hướng xu hướng trước đó, đi kèm xung lực mạnh (Displacement).
- **Liquidity Sweep (Quét thanh khoản 2 đầu - Turtle Soup / Judas Swing):** Hành vi đẩy giá xuyên qua vùng Equal Highs (EQH), Equal Lows (EQL), hoặc đỉnh/đáy phiên Á - Âu - Mỹ bằng râu nến (Wick) để kích hoạt Stop-Loss của lệnh ngược chiều VÀ dụ đám đông đánh Breakout cùng chiều trước khi rút chân đảo chiều.
- **Order Block (OB):** Nến ngược chiều cuối cùng trước cú đẩy xung lực mạnh (Displacement) gây ra BOS hoặc CHoCH. Đây là vùng MM để lại lệnh chờ hoặc cần quay lại trung hòa (Mitigation) các vị thế đối ứng.
- **Fair Value Gap (FVG / Imbalance):** Khoảng trống thanh khoản tạo bởi cụm 3 nến, trong đó râu nến 1 và râu nến 3 không chạm nhau, phản ánh sự mất cân bằng Mua/Bán cực đại. Giá có xu hướng hút về lấp đầy tối thiểu 50% FVG (Consequent Encroachment - CE).

---

## 2. Khung Suy Luận Nhân Quả (Causal Reasoning Rules)

### RULE SMC-01: Bullish Liquidity Sweep + CHoCH + OB/FVG Confluence (Bẫy Gấu Gom Long)
- **Bối cảnh thị trường (Market Context):** Khung lớn (H1/H4) đang trong cấu trúc tăng hoặc vùng chiết khấu (Discount < 50% Fibonacci). Giá tích lũy tạo đáy bằng nhau (Equal Lows - EQL) hoặc tiệm cận đáy phiên trước.
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Giá sập nhanh xuyên thủng vùng EQL/Support từ `0.3% - 1.2%` nhưng **không đóng thân nến dưới đáy**, rút râu nến dưới dài (Lower Wick > 50% biên độ nến).
  2. Ngay sau nến quét, xuất hiện nến tăng biên độ lớn (Displacement) đóng cửa vượt qua đỉnh ngắn hạn gần nhất tạo **Bullish CHoCH**, để lại khoảng trống **Bullish FVG** trùng khớp với **Bullish Order Block** ở đáy.
- **Hành vi của Cá mập (MM Behavior):** MM cố tình đạp giá thủng hỗ trợ để kích hoạt hàng loạt lệnh Sell Stop (cắt lỗ của phe Long) và khớp lệnh Limit Buy giá rẻ cho chính họ, đồng thời nhốt (trap) phe Short đuổi (Breakout Shorts) ở dưới đáy.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Mở `LONG` (Limit hoặc xác nhận LTF) khi giá hồi về vùng hợp lưu `Bullish FVG + Order Block` (vùng OTE 61.8% - 78.6%).
  - **Stop Loss (SL):** Đặt dưới điểm thấp nhất của râu nến Liquidity Sweep cộng thêm đệm biến động `0.5 × ATR(14)`.
  - **Take Profit (TP):** TP1 tại đỉnh cấu trúc nội tại (R:R 1:2), TP2 tại vùng thanh khoản đối diện (External Range Liquidity / Equal Highs - R:R 1:3+).

### RULE SMC-02: Bearish Liquidity Sweep + CHoCH + Supply OB/FVG (Bẫy Bò Xả Short)
- **Bối cảnh thị trường (Market Context):** Giá tăng nóng vào vùng Premium (> 50% biên độ khung lớn) hoặc chạm kháng cự tâm lý nơi có cụm Equal Highs (EQH).
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Giá phóng vọt qua đỉnh EQH (Sweep Buy-side Liquidity), rút râu trên dài (Upper Wick từ chối giá).
  2. Xuất hiện cụm nến giảm mạnh phá vỡ đáy swing gần nhất tạo **Bearish CHoCH**, hình thành **Bearish FVG** nằm ngay dưới **Bearish Order Block**.
- **Hành vi của Cá mập (MM Behavior):** MM đẩy giá vượt đỉnh để ép phe Short non gan phải cháy tài khoản (Buy-to-cover) và kích hoạt lệnh FOMO Long Breakout của đám đông làm thanh khoản đối ứng để MM khớp khối lượng lớn lệnh Short trên đỉnh.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Mở `SHORT` khi giá retest vùng `Bearish FVG + Bearish OB`.
  - **Stop Loss (SL):** Đặt trên đỉnh râu nến Sweep + `0.5 × ATR(14)`.
  - **Take Profit (TP):** Nhắm tới vùng Sell-side Liquidity (EQL phía dưới) hoặc vùng FVG chưa lấp bên dưới.

### RULE SMC-03: Inducement (IDM) & Trend Continuation BOS (Tiếp diễn xu hướng theo dòng tiền tổ chức)
- **Bối cảnh thị trường (Market Context):** Thị trường đang có xu hướng rõ rệt (EMA 9 nằm trên EMA 21 cho Uptrend, hoặc ngược lại cho Downtrend) vừa tạo **BOS** hợp lệ bằng thân nến.
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Sau BOS, giá hồi nhẹ tạo một đáy/đỉnh phụ giả (Inducement - IDM) ngay trước vùng Order Block chính (Extreme POI).
  2. Giá quét qua điểm IDM, lấp đầy FVG và phản ứng bật mạnh từ Order Block gốc.
- **Hành vi của Cá mập (MM Behavior):** Tạo vùng hỗ trợ/kháng cự giả (IDM) để dụ đám đông vào lệnh sớm, sau đó quét sạch SL của nhóm vào sớm này để nạp nhiên liệu trước khi đẩy giá đi tiếp theo xu hướng chính.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Tuyệt đối KHÔNG vào lệnh ở nhịp hồi đầu tiên chưa quét IDM. Chỉ vào lệnh `LONG` (trong Uptrend) hoặc `SHORT` (trong Downtrend) sau khi IDM đã bị quét và giá chạm vào vùng `OB + FVG` cực trị.

### RULE SMC-04: Double-Sided Liquidity Raid (Seek & Destroy / Quét thanh khoản 2 đầu)
- **Bối cảnh thị trường (Market Context):** Trước hoặc ngay khi công bố tin tức vĩ mô lớn (CPI, FOMC) hoặc mở cửa phiên Mỹ (NY Open), giá đi ngang trong biên độ hẹp (Consolidation Range).
- **Dấu hiệu dữ liệu (Data Signals):**
  1. Giá giật râu quét đỉnh biên độ tích lũy (lấy Buy-side Liquidity), sau đó lập tức đảo chiều sập thủng đáy biên độ (lấy Sell-side Liquidity) trong thời gian ngắn.
  2. Chỉ sau khi cả hai đầu thanh khoản đã bị quét, cấu trúc thật mới xuất hiện qua tín hiệu **CHoCH** kèm khối lượng đột biến.
- **Hành vi của Cá mập (MM Behavior):** Thuật toán MM mở rộng spread và quét sạch đòn bẩy cao ở cả hai phía Long và Short trước khi chọn hướng đi thực sự.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Đứng ngoài (Wait/Flat) ở cú quét đầu tiên. Chỉ vào lệnh ngược lại sau cú quét thứ hai khi có xác nhận đóng nến **CHoCH** quay lại vào trong biên độ (Range Reclaim).

