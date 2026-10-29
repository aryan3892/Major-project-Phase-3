// Measures gas per operation and read latency. Run: npx hardhat run scripts/gas.js
const { ethers } = require("hardhat");

async function main() {
  const F = await ethers.getContractFactory("PaperRegistry");
  const c = await F.deploy();
  const dep = await c.deploymentTransaction().wait();
  const H = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
  const rows = [{ operation: "deploy contract", gas: Number(dep.gasUsed) }];

  let r = await (await c.register(H("p1"), "Paper 1", "QmExampleCid1", ethers.ZeroHash)).wait();
  rows.push({ operation: "register (new paper)", gas: Number(r.gasUsed) });
  r = await (await c.register(H("p2"), "Paper 1 v2", "QmExampleCid2", H("p1"))).wait();
  rows.push({ operation: "register (new version)", gas: Number(r.gasUsed) });
  r = await (await c.retract(H("p1"))).wait();
  rows.push({ operation: "retract", gas: Number(r.gasUsed) });
  console.table(rows);

  const N = 200, t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) await c.verify(H("p1"));
  console.log("Average verify() latency:", (Number(process.hrtime.bigint() - t0) / 1e6 / N).toFixed(2), "ms (in-process chain)");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
