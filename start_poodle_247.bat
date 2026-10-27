@echo off
title POODLE QUANT AI 24/7 // MAY CHU TU DONG SAN KEO BINANCE
color 0b

echo ===================================================================
echo   POODLE QUANT AI // CHU CHO AI SAN KEO THU DONG 24/7
echo   He thong tu dong phuc hoi, khong bao gio ngat quang
echo ===================================================================
echo.

cd /d "%~dp0"

:loop
echo [%date% %time%] [24/7 Monitor] Dang khoi chay he thong Poodle Quant...
node src/server.js
echo.
echo [%date% %time%] [24/7 Monitor] He thong vua dung hoac bi gian doan.
echo [24/7 Monitor] Dang tu dong khoi dong lai sau 3 giay...
timeout /t 3 /nobreak >nul
goto loop
