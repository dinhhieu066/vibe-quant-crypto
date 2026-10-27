# 💎 VibeQuant AI // Private Autonomous Crypto Passive Terminal

Hệ thống điều hành và kiếm tiền thụ động 24/7 qua thị trường tiền mã hóa (Crypto Quantitative Trading) dành riêng cho chủ nhân.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dinhhieu066/vibe-quant-crypto)

---

## 🎯 Tổng Quan Hệ Thống

1. **Trạm Điều Hành Kiếm Tiền Thụ Động (Private Dashboard)**:
   - Theo dõi số dư vốn, lợi nhuận ròng thụ động (USD / VNĐ) và tỷ lệ thắng theo thời gian thực.
   - Thanh tiến độ mục tiêu thu nhập thụ động mỗi ngày (mặc định $10/ngày ~ 254k VNĐ, có thể tùy chỉnh).
   - Tự động cộng dồn lãi kép (Auto Compounding) vào vốn khả dụng.

2. **Binance Live Multi-Asset Radar (10 Đồng Coin Hàng Đầu)**:
   - Kết nối trực tiếp WebSocket không độ trễ với Binance cho 10 tài sản thanh khoản cao nhất: `BTC`, `ETH`, `SOL`, `BNB`, `DOGE`, `XRP`, `SUI`, `LINK`, `NEAR`, `AVAX`.
   - Tính toán chỉ báo kỹ thuật RSI(14), biến động giá, phân tích xung lực và chấm điểm tiềm năng AI (0 - 100).
   - Tự động nhận diện thiết lập giao dịch: *Siêu Quá Bán (Oversold Rebound)*, *Vùng Mua Hồi Phục (Dip Buy)*, *Siêu Quá Mua (Overbought Pullback)*, *Sóng Đẩy Momentum*.

3. **Thuật Toán AI Giao Dịch & Quản Trị Rủi Ro Chặt Chẽ**:
   - Tự động kích hoạt lệnh khi điểm cơ hội thị trường đạt $\ge 78/100$.
   - **Tùy chọn đòn bẩy cá nhân**: x1 (Spot an toàn), x2 (Thận trọng), x3 (Cân bằng tiêu chuẩn), x5 (Tăng trưởng nhanh).
   - **Trailing Breakeven Stop-Loss**: Tự động dời điểm cắt lỗ về giá hòa vốn ngay khi lệnh đạt lãi $\ge +1.0\%$.
   - **Chốt lời (TP) +2.2%** và **Cắt lỗ (SL) -1.2%** (Tỷ lệ R:R ~ 1.83).
   - Nút **Panic Close** đóng khẩn cấp mọi vị thế bằng giá thị trường tức thì.

4. **Truy Cập Bảo Mật & Riêng Tư (Cloudflare Tunnel)**:
   - Tự động sinh đường truyền HTTPS riêng tư qua Cloudflare Quick Tunnel để theo dõi và điều khiển từ điện thoại bất kỳ lúc nào.

---

## 🚀 Hướng Dẫn Sử Dụng

### 1. Khởi động hệ thống
```bash
npm start
```
- **Private Dashboard (Máy tính)**: [http://localhost:3000](http://localhost:3000)
- **Private Mobile Link**: Hiển thị trên thanh điều hướng hoặc trong cửa sổ dòng lệnh để mở trên điện thoại.

### 2. Thiết lập mục tiêu & mức vốn
- Bấm vào nút vốn nhanh **500k, 1Tr, 2Tr, 5Tr** để cấp vốn cho AI.
- Chọn đòn bẩy mong muốn (**x1, x2, x3, x5**).
- Bấm nút **"⚙️ Cài Đặt Mục Tiêu"** để điều chỉnh mức lợi nhuận thụ động kỳ vọng mỗi ngày/tháng.
- Bật công tắc **"AI TỰ ĐỘNG KIẾM TIỀN: ON"** và để hệ thống tự vận hành 24/7.
