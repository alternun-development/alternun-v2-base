import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GBTToken, GBTMinter, TreasuryManager, MockPriceOracle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GBTMinter", function () {
  let gbtToken: GBTToken;
  let minter: GBTMinter;
  let treasury: TreasuryManager;
  let oracle: MockPriceOracle;
  let stablecoin: any;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let projectPool: SignerWithAddress;
  let recoveryPool: SignerWithAddress;
  let alternunTreasury: SignerWithAddress;

  const INITIAL_GOLD_PRICE = ethers.parseUnits("65.50", 7);
  const FEE_BPS = 200;
  const COMMERCIAL_FACTOR_BPS = 8000;

  beforeEach(async function () {
    [owner, user, projectPool, recoveryPool, alternunTreasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await stablecoin.waitForDeployment();

    await stablecoin.mint(user.address, ethers.parseUnits("1000000", 6));

    const GBTTokenFactory = await ethers.getContractFactory("GBTToken");
    gbtToken = await GBTTokenFactory.deploy(owner.address);
    await gbtToken.waitForDeployment();

    const TreasuryFactory = await ethers.getContractFactory("TreasuryManager");
    treasury = await upgrades.deployProxy(
      TreasuryFactory,
      [
        await stablecoin.getAddress(),
        projectPool.address,
        recoveryPool.address,
        alternunTreasury.address,
        owner.address
      ],
      { initializer: 'initialize' }
    ) as any;
    await treasury.waitForDeployment();

    const OracleFactory = await ethers.getContractFactory("MockPriceOracle");
    oracle = await OracleFactory.deploy(INITIAL_GOLD_PRICE, owner.address);
    await oracle.waitForDeployment();

    const MinterFactory = await ethers.getContractFactory("GBTMinter");
    minter = await MinterFactory.deploy(
      await gbtToken.getAddress(),
      await treasury.getAddress(),
      await oracle.getAddress(),
      await stablecoin.getAddress(),
      FEE_BPS,
      COMMERCIAL_FACTOR_BPS,
      owner.address
    );
    await minter.waitForDeployment();

    await gbtToken.connect(owner).setMinter(await minter.getAddress());

    const reserves = {
      inferred: 0,
      indicated: 0,
      measured: 0,
      probable: 0,
      proven: 1000000
    };
    await minter.connect(owner).updateReserves(reserves);
  });

  describe("Deployment", function () {
    it("Should set correct initial parameters", async function () {
      expect(await minter.feeBps()).to.equal(FEE_BPS);
      expect(await minter.commercialFactorBps()).to.equal(COMMERCIAL_FACTOR_BPS);
    });

    it("Should calculate capacity correctly", async function () {
      const expectedCapacity = 5600000000000n;
      const capacity = await minter.calculateCapacity();
      expect(capacity).to.equal(expectedCapacity);
    });
  });

  describe("Reserve Management", function () {
    it("Should allow owner to update reserves", async function () {
      const newReserves = {
        inferred: 100000,
        indicated: 200000,
        measured: 300000,
        probable: 400000,
        proven: 500000
      };

      await expect(minter.connect(owner).updateReserves(newReserves))
        .to.emit(minter, "ReservesUpdated");
    });

    it("Should revert when non-owner tries to update reserves", async function () {
      const reserves = {
        inferred: 0,
        indicated: 0,
        measured: 0,
        probable: 0,
        proven: 1000000
      };

      await expect(
        minter.connect(user).updateReserves(reserves)
      ).to.be.revertedWithCustomError(minter, "OwnableUnauthorizedAccount");
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await stablecoin.connect(user).approve(
        await minter.getAddress(),
        ethers.parseUnits("1000000", 6)
      );
    });

    it("Should mint GBT successfully", async function () {
      const stablecoinAmount = ethers.parseUnits("200", 6);
      await expect(minter.connect(user).mint(stablecoinAmount))
        .to.emit(minter, "GBTMinted");
      expect(await gbtToken.balanceOf(user.address)).to.be.gt(0);
    });

    it("Should calculate preview correctly", async function () {
      const stablecoinAmount = ethers.parseUnits("200", 6);
      const [gbtAmount, feeAmount, goldPrice] = await minter.previewMint(stablecoinAmount);
      expect(goldPrice).to.equal(INITIAL_GOLD_PRICE);
      expect(feeAmount).to.equal(stablecoinAmount * 200n / 10000n);
      expect(gbtAmount).to.be.gt(0);
    });

    it("Should enforce minimum mint amount", async function () {
      const tinyAmount = ethers.parseUnits("10", 6);
      await expect(
        minter.connect(user).mint(tinyAmount)
      ).to.be.revertedWith("Minter: below minimum");
    });

    // TODO: Fix capacity calculation in test - currently skipped
    it.skip("Should respect capacity limits", async function () {
      await minter.connect(user).mint(ethers.parseUnits("36000", 6));
      await expect(
        minter.connect(user).mint(ethers.parseUnits("5000", 6))
      ).to.be.revertedWith("Minter: exceeds capacity");
    });

    it("Should distribute funds correctly to treasury", async function () {
      const stablecoinAmount = ethers.parseUnits("200", 6);
      await minter.connect(user).mint(stablecoinAmount);

      const projectBalance = await stablecoin.balanceOf(projectPool.address);
      const recoveryBalance = await stablecoin.balanceOf(recoveryPool.address);
      const alternunBalance = await stablecoin.balanceOf(alternunTreasury.address);

      expect(projectBalance).to.be.gt(0);
      expect(recoveryBalance).to.be.gt(0);
      expect(alternunBalance).to.be.gt(0);

      const netAmount = stablecoinAmount * 98n / 100n;
      const total = projectBalance + recoveryBalance + alternunBalance;
      expect(total).to.equal(netAmount);
    });

    it("Should collect fees correctly", async function () {
      const stablecoinAmount = ethers.parseUnits("200", 6);
      const expectedFee = stablecoinAmount * 200n / 10000n;
      await minter.connect(user).mint(stablecoinAmount);
      expect(await stablecoin.balanceOf(await minter.getAddress())).to.equal(expectedFee);
    });
  });

  describe("Parameter Updates", function () {
    it("Should allow owner to update fee", async function () {
      const newFee = 300;
      await expect(minter.connect(owner).setFeeBps(newFee))
        .to.emit(minter, "ParameterUpdated");
      expect(await minter.feeBps()).to.equal(newFee);
    });

    it("Should reject fee higher than 10%", async function () {
      await expect(
        minter.connect(owner).setFeeBps(1001)
      ).to.be.revertedWith("Minter: fee too high");
    });

    it("Should allow owner to update commercial factor", async function () {
      const newFactor = 7500;
      await minter.connect(owner).setCommercialFactorBps(newFactor);
      expect(await minter.commercialFactorBps()).to.equal(newFactor);
    });

    it("Should allow owner to update oracle", async function () {
      const newOracle = await (await ethers.getContractFactory("MockPriceOracle"))
        .deploy(INITIAL_GOLD_PRICE, owner.address);
      await minter.connect(owner).setOracle(await newOracle.getAddress());
      expect(await minter.oracle()).to.equal(await newOracle.getAddress());
    });
  });

  describe("Fee Withdrawal", function () {
    beforeEach(async function () {
      await stablecoin.connect(user).approve(
        await minter.getAddress(),
        ethers.parseUnits("10000", 6)
      );
      await minter.connect(user).mint(ethers.parseUnits("200", 6));
    });

    it("Should allow owner to withdraw fees", async function () {
      const feeBalance = await stablecoin.balanceOf(await minter.getAddress());
      expect(feeBalance).to.be.gt(0);
      const ownerBalanceBefore = await stablecoin.balanceOf(owner.address);
      await minter.connect(owner).withdrawFees(owner.address);
      const ownerBalanceAfter = await stablecoin.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + feeBalance);
    });

    it("Should revert when non-owner tries to withdraw", async function () {
      await expect(
        minter.connect(user).withdrawFees(user.address)
      ).to.be.revertedWithCustomError(minter, "OwnableUnauthorizedAccount");
    });
  });

  describe("Capacity Calculations", function () {
    it("Should calculate weighted capacity correctly for mixed reserves", async function () {
      const reserves = {
        inferred: 100000,
        indicated: 200000,
        measured: 300000,
        probable: 400000,
        proven: 500000
      };
      await minter.connect(owner).updateReserves(reserves);
      const capacity = await minter.calculateCapacity();
      expect(capacity).to.be.gt(0);
    });
  });
});