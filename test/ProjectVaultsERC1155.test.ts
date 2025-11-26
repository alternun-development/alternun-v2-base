import { expect } from "chai";
import { ethers } from "hardhat";
import { PGBTToken, ProjectVaults, GBTToken, EPTToken, MockUSDT } from "../typechain-types";
import { Signer } from "ethers";

describe("ProjectVaults with ERC-1155 pGBT", function () {
  let gbtToken: GBTToken;
  let pgbtToken: PGBTToken;
  let eptToken: EPTToken;
  let vaults: ProjectVaults;
  let usdt: MockUSDT;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let fundingPool: Signer;

  const STAKING_UNIT_5 = ethers.parseUnits("5", 7); // 5 GBT
  const STAKING_UNIT_15 = ethers.parseUnits("15", 7); // 15 GBT
  const FUNDING_GOAL = ethers.parseUnits("1000", 7); // 1000 GBT

  beforeEach(async function () {
    [owner, user1, user2, fundingPool] = await ethers.getSigners();

    // Deploy tokens
    const GBTFactory = await ethers.getContractFactory("GBTToken");
    gbtToken = await GBTFactory.deploy(await owner.getAddress());

    const PGBTFactory = await ethers.getContractFactory("PGBTToken");
    pgbtToken = await PGBTFactory.deploy(await owner.getAddress());

    const EPTFactory = await ethers.getContractFactory("EPTToken");
    eptToken = await EPTFactory.deploy(await owner.getAddress());

    // Deploy ProjectVaults
    const VaultsFactory = await ethers.getContractFactory("ProjectVaults");
    vaults = await VaultsFactory.deploy(
      await gbtToken.getAddress(),
      await pgbtToken.getAddress(),
      await eptToken.getAddress(),
      await owner.getAddress()
    );

    // CRITICAL: Set minters for all tokens
    await gbtToken.setMinter(await owner.getAddress());
    await pgbtToken.setMinter(await vaults.getAddress());
    await eptToken.setMinter(await vaults.getAddress());

    // Setup: Mint GBT to users for staking
    await gbtToken.mint(await user1.getAddress(), ethers.parseUnits("1000", 7));
    await gbtToken.mint(await user2.getAddress(), ethers.parseUnits("1000", 7));

    // Approve vaults
    await gbtToken.connect(user1).approve(await vaults.getAddress(), ethers.MaxUint256);
    await gbtToken.connect(user2).approve(await vaults.getAddress(), ethers.MaxUint256);
  });

  describe("Project Creation with Staking Units", function () {
    it("Should create project with staking unit", async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmHash123",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );

      const project = await vaults.getProject(0);
      expect(project.stakingUnit).to.equal(STAKING_UNIT_5);
      expect(project.name).to.equal("Solar Farm");
    });

    it("Should set metadata in pGBT contract", async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmHash123",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );

      const metadata = await pgbtToken.getProjectMetadata(0);
      expect(metadata.name).to.equal("Solar Farm");
      expect(metadata.stakingUnit).to.equal(STAKING_UNIT_5);
      expect(metadata.exists).to.be.true;
    });

    it("Should create multiple projects with different staking units", async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmHash1",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );

      await vaults.createProject(
        "Datacenter",
        "QmHash2",
        FUNDING_GOAL,
        STAKING_UNIT_15,
        await fundingPool.getAddress()
      );

      const project0 = await vaults.getProject(0);
      const project1 = await vaults.getProject(1);

      expect(project0.stakingUnit).to.equal(STAKING_UNIT_5);
      expect(project1.stakingUnit).to.equal(STAKING_UNIT_15);
    });
  });

  describe("Staking with Units", function () {
    beforeEach(async function () {
      // Create and activate project with 5 GBT staking unit
      await vaults.createProject(
        "Solar Farm",
        "QmHash123",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );
      await vaults.activateProject(0);
    });

    it("Should stake exact multiple of staking unit", async function () {
      const stakeAmount = ethers.parseUnits("15", 7); // 15 GBT = 3 units

      await expect(vaults.connect(user1).stake(0, stakeAmount))
        .to.emit(vaults, "Staked")
        .withArgs(0, await user1.getAddress(), stakeAmount, 3);

      // Check pGBT balance (ERC-1155)
      const balance = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      expect(balance).to.equal(3);
    });

    it("Should reject stake that is not multiple of staking unit", async function () {
      const invalidAmount = ethers.parseUnits("7", 7); // Not multiple of 5

      await expect(
        vaults.connect(user1).stake(0, invalidAmount)
      ).to.be.revertedWith("Amount must be multiple of staking unit");
    });

    it("Should calculate correct pGBT units", async function () {
      // Stake 20 GBT with unit of 5 = 4 pGBT units
      await vaults.connect(user1).stake(0, ethers.parseUnits("20", 7));

      const userStake = await vaults.getUserStake(0, await user1.getAddress());
      expect(userStake.pGBTUnits).to.equal(4);
    });

    it("Should handle multiple stakes from same user", async function () {
      await vaults.connect(user1).stake(0, ethers.parseUnits("10", 7)); // 2 units
      await vaults.connect(user1).stake(0, ethers.parseUnits("15", 7)); // 3 units

      const balance = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      expect(balance).to.equal(5); // Total 5 units

      const userStake = await vaults.getUserStake(0, await user1.getAddress());
      expect(userStake.pGBTUnits).to.equal(5);
      expect(userStake.gbtAmount).to.equal(ethers.parseUnits("25", 7));
    });

    it("Should route 50% to funding pool", async function () {
      const stakeAmount = ethers.parseUnits("20", 7);
      const expectedFunding = stakeAmount / 2n;

      const fundingPoolAddress = await fundingPool.getAddress();
      const balanceBefore = await gbtToken.balanceOf(fundingPoolAddress);

      await vaults.connect(user1).stake(0, stakeAmount);

      const balanceAfter = await gbtToken.balanceOf(fundingPoolAddress);
      expect(balanceAfter - balanceBefore).to.equal(expectedFunding);
    });
  });

  describe("Multi-Project Staking (ERC-1155)", function () {
    beforeEach(async function () {
      // Create two projects with different staking units
      await vaults.createProject(
        "Solar Farm",
        "QmHash1",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );
      await vaults.activateProject(0);

      await vaults.createProject(
        "Datacenter",
        "QmHash2",
        FUNDING_GOAL,
        STAKING_UNIT_15,
        await fundingPool.getAddress()
      );
      await vaults.activateProject(1);
    });

    it("Should track pGBT separately by project ID", async function () {
      // Stake in project 0 (5 GBT unit)
      await vaults.connect(user1).stake(0, ethers.parseUnits("10", 7)); // 2 units

      // Stake in project 1 (15 GBT unit)
      await vaults.connect(user1).stake(1, ethers.parseUnits("30", 7)); // 2 units

      const balanceProject0 = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      const balanceProject1 = await pgbtToken.balanceOf(await user1.getAddress(), 1);

      expect(balanceProject0).to.equal(2);
      expect(balanceProject1).to.equal(2);
    });

    it("Should allow different users to stake in same project", async function () {
      await vaults.connect(user1).stake(0, ethers.parseUnits("10", 7)); // 2 units
      await vaults.connect(user2).stake(0, ethers.parseUnits("15", 7)); // 3 units

      const balance1 = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      const balance2 = await pgbtToken.balanceOf(await user2.getAddress(), 0);

      expect(balance1).to.equal(2);
      expect(balance2).to.equal(3);
    });

    it("Should handle complex multi-project scenario", async function () {
      // User1: Stakes in both projects
      await vaults.connect(user1).stake(0, ethers.parseUnits("20", 7)); // 4 units in project 0
      await vaults.connect(user1).stake(1, ethers.parseUnits("45", 7)); // 3 units in project 1

      // User2: Stakes only in project 0
      await vaults.connect(user2).stake(0, ethers.parseUnits("15", 7)); // 3 units in project 0

      // Check all balances
      expect(await pgbtToken.balanceOf(await user1.getAddress(), 0)).to.equal(4);
      expect(await pgbtToken.balanceOf(await user1.getAddress(), 1)).to.equal(3);
      expect(await pgbtToken.balanceOf(await user2.getAddress(), 0)).to.equal(3);
      expect(await pgbtToken.balanceOf(await user2.getAddress(), 1)).to.equal(0);
    });
  });

  describe("Unstaking with Units", function () {
    beforeEach(async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmHash123",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );
      await vaults.activateProject(0);

      // User stakes 20 GBT (4 units)
      await vaults.connect(user1).stake(0, ethers.parseUnits("20", 7));
    });

    it("Should unstake by pGBT units", async function () {
      const balanceBefore = await gbtToken.balanceOf(await user1.getAddress());

      // Unstake 2 units (10 GBT)
      await vaults.connect(user1).unstake(0, 2);

      // Should return 9 GBT (10% penalty)
      const balanceAfter = await gbtToken.balanceOf(await user1.getAddress());
      const returned = balanceAfter - balanceBefore;
      expect(returned).to.equal(ethers.parseUnits("9", 7));

      // Check remaining pGBT
      const pgbtBalance = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      expect(pgbtBalance).to.equal(2);
    });

    it("Should burn pGBT when unstaking", async function () {
      const balanceBefore = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      expect(balanceBefore).to.equal(4);

      await vaults.connect(user1).unstake(0, 2);

      const balanceAfter = await pgbtToken.balanceOf(await user1.getAddress(), 0);
      expect(balanceAfter).to.equal(2);
    });

    it("Should reject unstake of more units than owned", async function () {
      await expect(
        vaults.connect(user1).unstake(0, 10)
      ).to.be.revertedWith("Insufficient pGBT units");
    });
  });

  describe("Project Metadata", function () {
    it("Should return correct URI for project", async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmTestHash123",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );

      const uri = await pgbtToken.uri(0);
      expect(uri).to.equal("ipfs://QmTestHash123");
    });

    it("Should check if project exists", async function () {
      await vaults.createProject(
        "Solar Farm",
        "QmHash",
        FUNDING_GOAL,
        STAKING_UNIT_5,
        await fundingPool.getAddress()
      );

      expect(await pgbtToken.projectExists(0)).to.be.true;
      expect(await pgbtToken.projectExists(999)).to.be.false;
    });
  });
});