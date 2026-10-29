@echo off
rem Starts the blockchain, deploys the contract, then starts backend and frontend.
rem BEFORE running: open IPFS Desktop and make sure MongoDB is running.
cd /d "%~dp0"
echo Make sure IPFS Desktop and MongoDB are running first.
echo.

start "1 - Blockchain node (do not close)" /d "%~dp0" cmd /k npx hardhat node
echo Waiting 10 seconds for the blockchain to start...
timeout /t 10 /nobreak >nul

echo Deploying smart contract...
call npx hardhat run scripts/deploy.js --network localhost
if errorlevel 1 (
  echo.
  echo Deploy failed. Check that the blockchain window is running, then try again.
  pause
  exit /b 1
)

start "2 - Backend API (do not close)" /d "%~dp0backend" cmd /k node server.js
start "3 - Frontend (do not close)" /d "%~dp0frontend" cmd /k npm run dev

echo Waiting for the website to start...
timeout /t 8 /nobreak >nul
start http://localhost:5173

echo.
echo All started. If you restarted the blockchain, reset MetaMask:
echo Settings - Advanced - Clear activity tab data
echo To stop everything, close the 3 black windows.
pause
