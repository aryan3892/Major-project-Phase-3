require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { ethers } = require("ethers");
const info = require("./contract.json");

const {
  PORT = 4000,
  MONGO_URI = "mongodb://127.0.0.1:27017/paperverify",
  RPC_URL = "http://127.0.0.1:8545",
  IPFS_API = "http://127.0.0.1:5001",
  IPFS_GATEWAY = "http://127.0.0.1:8080",
} = process.env;

const registry = new ethers.Contract(info.address, info.abi, new ethers.JsonRpcProvider(RPC_URL));

const Paper = mongoose.model("Paper", new mongoose.Schema({
  hash: { type: String, unique: true },
  title: String, authors: String, abstract: String,
  cid: String, txHash: String, authorAddress: String,
  version: Number, retracted: { type: Boolean, default: false },
}, { timestamps: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const app = express();
app.use(cors());
app.use(express.json());
const h = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

// Store a file on the local IPFS node (IPFS Desktop) and return its CID.
async function ipfsAdd(buffer, name) {
  const fd = new FormData();
  fd.append("file", new Blob([buffer]), name);
  const r = await fetch(`${IPFS_API}/api/v0/add?pin=true`, { method: "POST", body: fd });
  if (!r.ok) throw new Error("IPFS add failed (is IPFS Desktop running?) status " + r.status);
  return (await r.json()).Hash;
}

// Read the authoritative record straight from the smart contract.
async function chainRecord(hash) {
  const [exists, p] = await registry.verify(hash);
  if (!exists) return { exists: false };
  return {
    exists: true, author: p.author, title: p.title, cid: p.cid,
    timestamp: Number(p.timestamp), version: Number(p.version),
    retracted: p.retracted, previousHash: p.previousHash,
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, contract: info.address }));

// 1. Upload PDF -> SHA-256 + IPFS CID
app.post("/api/upload", upload.single("file"), h(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const hash = "0x" + crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const cid = await ipfsAdd(req.file.buffer, req.file.originalname);
  res.json({ hash, cid, url: `${IPFS_GATEWAY}/ipfs/${cid}` });
}));

// 2. After the author's on-chain transaction, save searchable metadata in MongoDB
app.post("/api/papers", h(async (req, res) => {
  const { hash, title, authors, abstract, cid, txHash } = req.body;
  const chain = await chainRecord(hash);
  if (!chain.exists) return res.status(400).json({ error: "Hash is not registered on-chain" });
  const doc = await Paper.findOneAndUpdate(
    { hash },
    { hash, title, authors, abstract, cid, txHash, authorAddress: chain.author, version: chain.version, retracted: chain.retracted },
    { upsert: true, new: true }
  );
  res.json(doc);
}));

app.get("/api/papers", h(async (_req, res) => {
  res.json(await Paper.find().sort({ createdAt: -1 }).limit(100));
}));

// 3. Verify: on-chain truth + off-chain metadata
app.get("/api/verify/:hash", h(async (req, res) => {
  const chain = await chainRecord(req.params.hash);
  const record = chain.exists ? await Paper.findOne({ hash: req.params.hash }) : null;
  res.json({ hash: req.params.hash, chain, record, url: chain.exists ? `${IPFS_GATEWAY}/ipfs/${chain.cid}` : null });
}));

// 4. After a retraction transaction, sync the flag into MongoDB
app.post("/api/papers/:hash/sync", h(async (req, res) => {
  const chain = await chainRecord(req.params.hash);
  if (!chain.exists) return res.status(404).json({ error: "Not on-chain" });
  const doc = await Paper.findOneAndUpdate({ hash: req.params.hash }, { retracted: chain.retracted }, { new: true });
  res.json(doc);
}));

mongoose.connect(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT} | contract ${info.address}`)))
  .catch((e) => { console.error("MongoDB connection failed (is MongoDB running?):", e.message); process.exit(1); });
