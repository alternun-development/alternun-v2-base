import { expect } from "chai";
import { ethers } from "hardhat";
import { MineRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MineRegistry", function () {
  let mineRegistry: MineRegistry;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const MineRegistry = await ethers.getContractFactory("MineRegistry");
    mineRegistry = await MineRegistry.deploy(owner.address);
  });

  describe("Mine Registration", function () {
    it("Should register a new mine", async function () {
      await mineRegistry.registerMine(
        "AL-1 Mine",
        "Colombia",
        "Nechí",
        "Bajo Cauca region",
        "Initial registration"
      );

      expect(await mineRegistry.mineCount()).to.equal(1);
      
      const mine = await mineRegistry.getMine(0);
      expect(mine.name).to.equal("AL-1 Mine");
      expect(mine.country).to.equal("Colombia");
      expect(mine.municipality).to.equal("Nechí");
      expect(mine.isActive).to.equal(true);
    });

    it("Should only allow owner to register mines", async function () {
      await expect(
        mineRegistry.connect(addr1).registerMine(
          "AL-1 Mine",
          "Colombia",
          "Nechí",
          "Bajo Cauca region",
          "Initial registration"
        )
      ).to.be.revertedWithCustomError(mineRegistry, "OwnableUnauthorizedAccount");
    });
  });

  describe("NI 43-101 Reports", function () {
    beforeEach(async function () {
      await mineRegistry.registerMine(
        "AL-1 Mine",
        "Colombia",
        "Nechí",
        "Bajo Cauca region",
        "Initial registration"
      );
    });

    it("Should add NI 43-101 report", async function () {
      const reportDate = Math.floor(Date.now() / 1000);
      
      await mineRegistry.addNI43101Report(
        0,
        "QmTestHash123",
        reportDate,
        "NI43-101-2024-001",
        ethers.parseUnits("535400", 7),
        ethers.parseUnits("50000", 7),
        ethers.parseUnits("25000", 7),
        0n,
        ethers.parseUnits("1000", 7)
      );

      expect(await mineRegistry.getReportCount(0)).to.equal(1);
      
      const report = await mineRegistry.getLatestReport(0);
      expect(report.ipfsHash).to.equal("QmTestHash123");
      expect(report.reportNumber).to.equal("NI43-101-2024-001");
    });

    it("Should get latest reserves", async function () {
      const reportDate = Math.floor(Date.now() / 1000);
      
      await mineRegistry.addNI43101Report(
        0,
        "QmTestHash123",
        reportDate,
        "NI43-101-2024-001",
        ethers.parseUnits("535400", 7),
        ethers.parseUnits("50000", 7),
        ethers.parseUnits("25000", 7),
        0n,
        ethers.parseUnits("1000", 7)
      );

      const reserves = await mineRegistry.getLatestReserves(0);
      expect(reserves.inferred).to.equal(ethers.parseUnits("535400", 7));
      expect(reserves.proven).to.equal(ethers.parseUnits("1000", 7));
    });

    it("Should add multiple reports", async function () {
      const reportDate1 = Math.floor(Date.now() / 1000);
      
      await mineRegistry.addNI43101Report(
        0, "QmHash1", reportDate1, "NI-001",
        ethers.parseUnits("1000", 7), 0n, 0n, 0n, 0n
      );

      const reportDate2 = reportDate1 + 86400;
      
      await mineRegistry.addNI43101Report(
        0, "QmHash2", reportDate2, "NI-002",
        ethers.parseUnits("2000", 7), 0n, 0n, 0n, 0n
      );

      expect(await mineRegistry.getReportCount(0)).to.equal(2);
      
      const latest = await mineRegistry.getLatestReport(0);
      expect(latest.ipfsHash).to.equal("QmHash2");
    });
  });

  describe("Mine Updates", function () {
    beforeEach(async function () {
      await mineRegistry.registerMine(
        "AL-1 Mine",
        "Colombia",
        "Nechí",
        "Bajo Cauca region",
        "Initial registration"
      );
    });

    it("Should update mine metadata", async function () {
      await mineRegistry.updateMineMetadata(
        0,
        "AL-1 Updated",
        "Colombia",
        "Amalfi",
        "New location",
        "Updated notes"
      );

      const mine = await mineRegistry.getMine(0);
      expect(mine.name).to.equal("AL-1 Updated");
      expect(mine.municipality).to.equal("Amalfi");
      expect(mine.notes).to.equal("Updated notes");
    });

    it("Should toggle mine active status", async function () {
      await mineRegistry.setMineActive(0, false);
      
      const mine = await mineRegistry.getMine(0);
      expect(mine.isActive).to.equal(false);
    });
  });
});