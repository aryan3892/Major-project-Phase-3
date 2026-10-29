const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaperRegistry", function () {
  let registry, author, other;
  const H1 = ethers.keccak256(ethers.toUtf8Bytes("paper v1"));
  const H2 = ethers.keccak256(ethers.toUtf8Bytes("paper v2"));
  const ZERO = ethers.ZeroHash;
  const CID = "QmExampleCid";

  beforeEach(async () => {
    [author, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("PaperRegistry");
    registry = await F.deploy();
    await registry.waitForDeployment();
  });

  it("registers a paper and verifies it", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    const [exists, p] = await registry.verify(H1);
    expect(exists).to.equal(true);
    expect(p.author).to.equal(author.address);
    expect(p.title).to.equal("My Paper");
    expect(p.version).to.equal(1);
    expect(p.retracted).to.equal(false);
  });

  it("stores the IPFS CID", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    const [, p] = await registry.verify(H1);
    expect(p.cid).to.equal(CID);
  });

  it("reports unknown hashes as not existing", async () => {
    const [exists] = await registry.verify(H1);
    expect(exists).to.equal(false);
  });

  it("rejects duplicate registration", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    await expect(registry.register(H1, "Again", CID, ZERO)).to.be.revertedWith("Already registered");
  });

  it("links versions and increments version number", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    await registry.register(H2, "My Paper (rev)", "QmRev", H1);
    const [, p] = await registry.verify(H2);
    expect(p.version).to.equal(2);
    expect(p.previousHash).to.equal(H1);
  });

  it("only the author can add a version", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    await expect(registry.connect(other).register(H2, "Hijack", CID, H1))
      .to.be.revertedWith("Only author can add a version");
  });

  it("only the author can retract", async () => {
    await registry.register(H1, "My Paper", CID, ZERO);
    await expect(registry.connect(other).retract(H1)).to.be.revertedWith("Only author can retract");
    await registry.retract(H1);
    const [, p] = await registry.verify(H1);
    expect(p.retracted).to.equal(true);
  });

  it("emits events", async () => {
    await expect(registry.register(H1, "My Paper", CID, ZERO)).to.emit(registry, "Registered");
    await expect(registry.retract(H1)).to.emit(registry, "Retracted");
  });
});
