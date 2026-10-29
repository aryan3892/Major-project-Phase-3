const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const F = await hre.ethers.getContractFactory("PaperRegistry");
  const c = await F.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();
  const artifact = await hre.artifacts.readArtifact("PaperRegistry");
  const json = JSON.stringify({ address, abi: artifact.abi }, null, 2);
  fs.writeFileSync("backend/contract.json", json);
  fs.writeFileSync("frontend/src/contract.json", json);
  console.log("PaperRegistry deployed to:", address);
  console.log("Saved address + ABI to backend/contract.json and frontend/src/contract.json");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
