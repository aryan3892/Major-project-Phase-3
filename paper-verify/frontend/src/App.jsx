import { useEffect, useState } from "react";
import { BrowserProvider, Contract, ZeroHash } from "ethers";
import info from "./contract.json";

const HARDHAT = {
  chainId: "0x7a69", chainName: "Hardhat Local",
  rpcUrls: ["http://127.0.0.1:8545"],
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
};

async function api(path, opts) {
  const r = await fetch("/api" + path, opts);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

// SHA-256 computed in the browser: the paper never has to leave the machine to be verified.
async function sha256(file) {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return "0x" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not found. Please install it.");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HARDHAT.chainId }] });
  } catch {
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [HARDHAT] });
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { account: await signer.getAddress(), contract: new Contract(info.address, info.abi, signer) };
}

function Msg({ m }) {
  if (!m) return null;
  return (
    <div className={"msg " + m.kind}>
      <b>{m.title}</b>
      {(m.lines || []).map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("register");
  const [wallet, setWallet] = useState(null);
  const [m, setM] = useState(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: "", authors: "", abstract: "", prev: "" });
  const [vr, setVr] = useState(null);
  const [papers, setPapers] = useState([]);

  const say = (kind, title, lines = []) => setM({ kind, title, lines });
  const run = (fn) => async () => {
    try { await fn(); } catch (e) { say("bad", "❌ " + (e.shortMessage || e.reason || e.message)); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const needWallet = () => { if (!wallet) throw new Error("Connect MetaMask first."); };
  const switchTab = (t) => { setTab(t); setM(null); setVr(null); setFile(null); };

  useEffect(() => {
    if (tab === "papers") api("/papers").then(setPapers).catch((e) => say("bad", "❌ " + e.message));
  }, [tab]);

  const connect = run(async () => {
    setWallet(await connectWallet());
  });

  const register = run(async () => {
    needWallet();
    if (!file || !form.title) throw new Error("Choose a file and enter a title.");
    say("warn", "Uploading to IPFS…");
    const fd = new FormData(); fd.append("file", file);
    const up = await api("/upload", { method: "POST", body: fd });
    say("warn", "Confirm the transaction in MetaMask…");
    const tx = await wallet.contract.register(up.hash, form.title, up.cid, form.prev.trim() || ZeroHash);
    await tx.wait();
    await api("/papers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: up.hash, title: form.title, authors: form.authors, abstract: form.abstract, cid: up.cid, txHash: tx.hash }),
    });
    say("ok", "✅ Registered on blockchain", ["SHA-256: " + up.hash, "IPFS CID: " + up.cid, "Tx: " + tx.hash]);
  });

  const verify = run(async () => {
    if (!file) throw new Error("Choose a file.");
    const r = await api("/verify/" + (await sha256(file)));
    setVr(r);
    const c = r.chain;
    if (!c.exists) return say("bad", "❌ Not found / possibly tampered", ["No on-chain record matches this file.", "Hash: " + r.hash]);
    const lines = [
      "Title: " + c.title, "Author: " + c.author,
      "Registered: " + new Date(c.timestamp * 1000).toLocaleString(), "Version: " + c.version,
      "IPFS CID: " + c.cid, "Hash: " + r.hash,
    ];
    if (r.record?.authors) lines.splice(2, 0, "Authors: " + r.record.authors);
    if (c.previousHash !== ZeroHash) lines.push("Previous version: " + c.previousHash);
    if (c.retracted) say("warn", "⚠️ Authentic but RETRACTED", lines);
    else say("ok", "✅ Authentic – matches the on-chain record", lines);
  });

  const retract = run(async () => {
    needWallet();
    say("warn", "Confirm the transaction in MetaMask…");
    const tx = await wallet.contract.retract(vr.hash);
    await tx.wait();
    await api(`/papers/${vr.hash}/sync`, { method: "POST" });
    say("warn", "⚠️ Paper marked as retracted", ["Tx: " + tx.hash]);
    setVr(null);
  });

  const canRetract = vr?.chain?.exists && !vr.chain.retracted && wallet &&
    wallet.account.toLowerCase() === vr.chain.author.toLowerCase();

  return (
    <div className="wrap">
      <h1>PaperVerify</h1>
      <div className="sub">Blockchain-based research publication verification (Ethereum · IPFS · MongoDB)</div>

      <div className="bar">
        <button className="ghost" onClick={connect}>{wallet ? "Reconnect" : "Connect MetaMask"}</button>
        <small>{wallet ? "Connected: " + wallet.account.slice(0, 8) + "…" + wallet.account.slice(-6) : "Not connected"}</small>
      </div>

      <div className="tabs">
        {["register", "verify", "papers"].map((t) => (
          <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => switchTab(t)}>
            {t === "papers" ? "All papers" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "register" && (
        <div className="card">
          <label>Paper (PDF)</label><input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <label>Title</label><input value={form.title} onChange={set("title")} />
          <label>Authors</label><input value={form.authors} onChange={set("authors")} placeholder="A. Kumar, B. Singh" />
          <label>Abstract</label><textarea rows="3" value={form.abstract} onChange={set("abstract")} />
          <label>Previous version hash (optional, for a revised version)</label><input value={form.prev} onChange={set("prev")} placeholder="0x…" />
          <button onClick={register}>Upload to IPFS and register</button>
        </div>
      )}

      {tab === "verify" && (
        <div className="card">
          <label>Paper file to check</label><input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={verify}>Verify</button>
          {canRetract && <button className="ghost" style={{ marginLeft: 8 }} onClick={retract}>Retract this paper</button>}
          {vr?.url && <div style={{ marginTop: 10 }}><a href={vr.url} target="_blank" rel="noreferrer">Open original from IPFS</a></div>}
        </div>
      )}

      {tab === "papers" && (
        <div className="card">
          {papers.length === 0 && <small>No papers registered yet.</small>}
          {papers.map((p) => (
            <div className="item" key={p.hash}>
              <b>{p.title}</b> {p.retracted && "⚠️ retracted"} <small>v{p.version}</small><br />
              <small>{p.authors} · {new Date(p.createdAt).toLocaleString()}</small><br />
              <small>{p.hash}</small><br />
              <a href={`http://127.0.0.1:8080/ipfs/${p.cid}`} target="_blank" rel="noreferrer">Open on IPFS</a>
            </div>
          ))}
        </div>
      )}

      <Msg m={m} />
    </div>
  );
}
