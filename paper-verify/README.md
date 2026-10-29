# PaperVerify - Blockchain-Based Research Publication Verification

Stack: Solidity + Hardhat (Ethereum) - MetaMask - IPFS Desktop - Node.js/Express - MongoDB - React (Vite) - SHA-256 - Python

## Prerequisites
Node.js 18+, MetaMask browser extension, IPFS Desktop (running), MongoDB Community Server (running), Python 3 (optional).

## Run (4 terminals, start from the project root)
```
npm install
npx hardhat test                                         # 7 tests should pass

# Terminal 1 - blockchain (leave running)
npx hardhat node

# Terminal 2 - deploy (writes ABI + address for backend and frontend)
npx hardhat run scripts/deploy.js --network localhost

# Terminal 3 - API
cd backend
npm install
node server.js

# Terminal 4 - website
cd frontend
npm install
npm run dev          # open http://localhost:5173
```
In MetaMask: import a test account using a private key printed by `npx hardhat node`
(the app adds the "Hardhat Local" network itself, approve the popup). Test keys only - never use real funds.
After restarting the node: deploy again, restart the backend, and reset the account in MetaMask
(Settings > Advanced > Clear activity tab data).

## Experiments for the report
```
npx hardhat run scripts/gas.js     # gas per operation + verify latency
python python/benchmark.py         # hashing time vs size, tamper detection rate
python python/similarity.py a.txt b.txt
```

## How it works
1. Browser sends the PDF to the API; API computes SHA-256 and stores the file on IPFS (returns a CID).
2. The author signs a transaction in MetaMask: contract stores hash, CID, title, author, time, version.
3. API saves searchable metadata (authors, abstract, tx hash) in MongoDB after checking the chain.
4. Verify: browser hashes the file; API reads the contract (source of truth) + MongoDB; result is authentic / not found / retracted.
