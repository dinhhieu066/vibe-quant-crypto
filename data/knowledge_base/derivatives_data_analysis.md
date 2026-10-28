# PILLAR 2: DERIVATIVES DATA ANALYSIS CAUSAL FRAMEWORK (OI, FUNDING, CVD, LIQUIDATION HEATMAP)

## 1. Ma Trận Giải Mã Dữ Liệu Phái Sinh Crypto Futures
Khác với thị trường Spot, thị trường Crypto Perpetual Futures bị chi phối bởi **vị thế mở (Open Interest)**, **chi phí giữ lệnh (Funding Rate)**, **dòng lệnh chủ động (CVD)** và **các cụm thanh lý (Liquidation Clusters)**. Kết hợp 4 chỉ số này giúp bóc tách chính xác ai đang nằm ở thế bị động (cá con FOMO) và ai đang kiểm soát cuộc chơi (Market Makers).

| Trạng thái Giá (Price) | Open Interest (OI) | CVD (Market Takers) | Funding Rate | Bản chất dòng tiền & Hành vi MM |
| :--- | :--- | :--- | :--- | :--- |
| **Giá Tăng ($\uparrow$)** | **OI Tăng ($\uparrow$)** | **CVD Tăng ($\uparrow$)** | Dương nhẹ / Trung lập | **Bullish thực chất:** Tiền mới đổ vào mở Long chủ động, xu hướng tăng bền vững. |
| **Giá Tăng ($\uparrow$)** | **OI Tăng ($\uparrow$)** | **CVD Giảm/Đi ngang** | Dương rất cao (`> 0.03%`) | **Bẫy Long / Hấp thụ bán (Limit Sell Absorption):** Retail FOMO Long nhưng MM đang rải lệnh Limit Sell hấp thụ toàn bộ lực mua. Sắp đảo chiều giảm. |
| **Giá Tăng ($\uparrow$)** | **OI Giảm ($\downarrow$)** | **CVD Tăng vọt ($\uparrow$)** | Âm sâu (`< -0.02%`) | **Short Squeeze (Đóng lệnh Short):** Giá tăng do phe Short bị thanh lý hoặc buộc phải mua lại (Buy-to-cover), hết lực squeeze giá sẽ chững lại. |
| **Giá Giảm ($\downarrow$)** | **OI Tăng ($\uparrow$)** | **CVD Giảm sâu ($\downarrow$)** | Âm nhẹ / Trung lập | **Bearish thực chất:** Dòng tiền lớn chủ động mở vị thế Short mới đẩy giá xuống. |
| **Giá Giảm ($\downarrow$)** | **OI Tăng ($\uparrow$)** | **CVD Tăng/Đáy cao hơn** | Âm sâu (`< -0.03%`) | **Bẫy Short / Hấp thụ mua (Limit Buy Absorption):** Đám đông đuổi Short ở đáy nhưng MM đặt tường Limit Buy gom sạch. Chuẩn bị nổ Short Squeeze. |
| **Giá Giảm ($\downarrow$)** | **OI Giảm ($\downarrow$)** | **CVD Giảm vọt ($\downarrow$)** | Từ dương cao về trung lập | **Long Liquidation Cascade (Thanh lý Long dây chuyền):** Phe Long đòn bẩy cao bị ép bán tháo. Khi OI sụt giảm mạnh xong là vùng tạo đáy ngắn hạn. |

---

## 2. Khung Suy Luận Nhân Quả (Causal Reasoning Rules)

### RULE DERIV-01: Crowded Long Trap & Long Liquidation Cascade (Bẫy Đám Đông Hưng Phấn -> Đánh Short)
- **Bối cảnh thị trường (Market Context):** Giá đã tăng liên tục nhiều nhịp và bắt đầu đi ngang ở vùng kháng cự. Tỷ lệ Long/Short Ratio của đám đông (Retail Accounts) vượt ngưỡng `> 2.0` (trên 67% tài khoản đang Long).
- **Dấu hiệu dữ liệu (Data Signals):**
  1. **Open Interest (OI):** Tăng vọt lên vùng đỉnh lịch sử ngắn hạn trong khi giá không tạo được đỉnh mới tương xứng (OI tăng nhưng giá đình trệ).
  2. **Funding Rate:** Dương cực đại (`> +0.03%` đến `+0.10%` mỗi 8h), phản ánh đám đông sẵn sàng trả phí cao để giữ lệnh Long đòn bẩy.
  3. **CVD (Cumulative Volume Delta):** Phân kỳ giảm (Bearish CVD Divergence) — CVD tạo đỉnh cao hơn nhờ lệnh Market Buy của Retail nhưng giá bị chặn đứng bởi tường Limit Sell của MM.
  4. **Liquidation Heatmap:** Xuất hiện cụm thanh lý Long dày đặc (vùng màu vàng/sáng rực) nằm ngay dưới đáy ngắn hạn `1.5% - 3%`.
- **Hành vi của Cá mập (MM Behavior):** MM đã khớp xong toàn bộ vị thế Short thông qua các lệnh Limit Sell hấp thụ lực mua FOMO của Retail. Giờ đây MM chỉ cần xả một lượng Spot/Futures vừa đủ để đạp giá chạm vào cụm Liquidation Heatmap phía dưới, kích hoạt hiệu ứng domino lệnh Long tự động bán tháo (Forced Market Sell).
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Tuyệt đối cấm mở Long. Canh mở `SHORT` khi giá gãy cấu trúc hỗ trợ nhỏ (CHoCH giảm).
  - **Mục tiêu chốt lời (TP):** Đặt TP ngay tại tâm điểm của cụm **Liquidation Heatmap** bên dưới nơi OI bắt đầu sụt giảm mạnh.

### RULE DERIV-02: Aggressive Short Trap & Short Squeeze Ignition (Bẫy Đuổi Short Đáy -> Đánh Long)
- **Bối cảnh thị trường (Market Context):** Giá vừa trải qua nhịp điều chỉnh hoặc đi ngang gần đáy hỗ trợ, tâm lý thị trường bi quan cực độ.
- **Dấu hiệu dữ liệu (Data Signals):**
  1. **Open Interest (OI) + Funding Rate:** OI tăng mạnh khi giá chạm đáy nhưng Funding Rate chuyển sang **âm sâu** (`< -0.02%`), chứng tỏ đám đông đang hung hãn mở Short đuổi ngay tại hỗ trợ (Late Shorts).
  2. **CVD Absorption:** CVD cắm xuống rất sâu (lực Market Sell lớn) nhưng giá không thể thủng đáy hỗ trợ (Phân kỳ hấp thụ: Effort bán lớn nhưng Result giảm giá bằng 0).
  3. **Liquidation Heatmap:** Tích tụ cụm thanh lý Short khổng lồ ngay phía trên đỉnh vùng tích lũy.
- **Hành vi của Cá mập (MM Behavior):** MM dùng lệnh Limit Buy âm thầm gom hết toàn bộ lượng hợp đồng Short mà đám đông bán ra ở đáy. Khi đám đông đã kẹt cứng trong vị thế Short đòn bẩy cao, MM đẩy giá vượt nhẹ qua kháng cự gần nhất để ép toàn bộ phe Short bị thanh lý (Forced Market Buy), biến lệnh cháy của phe Short thành nhiên liệu đẩy giá dựng cột.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Mở `LONG` đón đầu sóng Short Squeeze ngay khi giá đóng nến vượt vùng tích lũy nhỏ kèm CVD ngoặt lên dương.
  - **Mục tiêu chốt lời (TP):** Chốt lời từng phần khi giá quét qua cụm Liquidation Heatmap phía trên và khi OI giảm đột ngột (dấu hiệu phe Short đã bị thanh lý xong).

### RULE DERIV-03: Capitulation Flush & OI Reset Reversal (Xả Thanh Lý Cạn Kiệt -> Bắt Đáy Đảo Chiều)
- **Bối cảnh thị trường (Market Context):** Thị trường sập mạnh dây chuyền (Flash Crash), RSI rơi vào vùng siêu quá bán (`<= 25`).
- **Dấu hiệu dữ liệu (Data Signals):**
  1. **Open Interest (OI):** Sụt giảm thẳng đứng (`-10%` đến `-25%` trong vài giờ) do hàng loạt lệnh Long bị ép thanh lý (Forced Liquidation).
  2. **Funding Rate:** Từ dương cao rơi thẳng về `0%` hoặc chuyển sang âm ngay lập tức.
  3. **CVD & Volume:** Volume nổ đột biến cực đại tại cây nến rút râu dưới dài, sau đó CVD ngừng giảm và bắt đầu đi ngang/tăng nhẹ.
- **Hành vi của Cá mập (MM Behavior):** Quá trình "dọn dẹp đòn bẩy" (Leverage Flush) đã hoàn tất. MM đã mua lại toàn bộ tài sản giá rẻ từ các lệnh cháy của Retail. Khi không còn lệnh Long nào để thanh lý thêm, áp lực bán cưỡng bức biến mất hoàn toàn.
- **Kịch bản hành động (Action Plan):**
  - **Vị thế:** Mở `LONG` (Mean-Reversion Rebound) ngay sau khi nến rũ bỏ đóng cửa rút chân và OI bắt đầu đi ngang ổn định.
  - **Quản trị rủi ro:** Đặt SL dưới đáy râu nến Capitulation, kỳ vọng nhịp hồi phục nhanh (V-shape bounce) về EMA 21.

