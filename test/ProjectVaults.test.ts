import { expect } from "chai";
import { ethers } from "hardhat";
import { ProjectVaults, GBTToken, PGBTToken, EPTToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ProjectVaults", function () {
  let vaults: ProjectVaults;
  let gbtToken: GBTToken;
  let pgbtToken: PGBTToken;
  let eptToken: EPTToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let kycVerifier: SignerWithAddress;
  let fundingPool: SignerWithAddress;

  const UNSTAKE_PENALTY_BPS = 500; // 5%

  beforeEach(async function () {
    [owner, user1, user2, kycVerifier, fundingPool] = await ethers.getSigners();

    // Deploy tokens
    const GBTTokenFactory = await ethers.getContractFactory("GBTToken");
    gbtToken = await GBTTokenFactory.deploy(owner.address);
    await gbtToken.waitForDeployment();

    const PGBTTokenFactory = await ethers.getContractFactory("PGBTToken");
    pgbtToken = await PGBTTokenFactory.deploy(owner.address);
    await pgbtToken.waitForDeployment();

    const EPTTokenFactory = await ethers.getContractFactory("EPTToken");
    eptToken = await EPTTokenFactory.deploy(owner.address);
    await eptToken.waitForDeployment();

    // Deploy ProjectVaults
    const ProjectVaultsFactory = await ethers.getContractFactory("ProjectVaults");
    vaults = await ProjectVaultsFactory.deploy(
      await gbtToken.getAddress(),
      await pgbtToken.getAddress(),
      await eptToken.getAddress(),
      kycVerifier.address,
      UNSTAKE_PENALTY_BPS,
      owner.address
    );
    await vaults.waitForDeployment();

    // Set vaults as minter for pGBT and ePT
    await pgbtToken.setMinter(await vaults.getAddress());
    await eptToken.setMinter(await vaults.getAddress());

    // Mint some GBT to users for testing
    await gbtToken.setMinter(owner.address);
    await gbtToken.mint(user1.address, ethers.parseUnits("1000", 7)); // 1000 GBT
    await gbtToken.mint(user2.address, ethers.parseUnits("500", 7));  // 500 GBT
  });

  describe("Deployment", function () {
    it("Should set correct initial parameters", async function () {
      expect(await vaults.gbtToken()).to.equal(await gbtToken.getAddress());
      expect(await vaults.pgbtToken()).to.equal(await pgbtToken.getAddress());
      expect(await vaults.eptToken()).to.equal(await eptToken.getAddress());
      expect(await vaults.kycVerifier()).to.equal(kycVerifier.address);
      expect(await vaults.unstakePenaltyBps()).to.equal(UNSTAKE_PENALTY_BPS);
    });

    it("Should start with project count at 0", async function () {
      expect(await vaults.projectCount()).to.equal(0);
    });
  });

  describe("Project Creation", function () {
    it("Should allow owner to create project", async function () {
      const fundingGoal = ethers.parseUnits("10000", 7); // 10,000 GBT

      await expect(
        vaults.connect(owner).createProject(
          "Solar Farm Project",
          "QmTest123",
          fundingGoal,
          fundingPool.address
        )
      ).to.emit(vaults, "ProjectCreated")
        .withArgs(0, "Solar Farm Project", fundingGoal);

      const project = await vaults.projects(0);
      expect(project.name).to.equal("Solar Farm Project");
      expect(project.ipfsHash).to.equal("QmTest123");
      expect(project.fundingGoal).to.equal(fundingGoal);
      expect(project.state).to.equal(0); // Proposed
      expect(project.acceptingStakes).to.equal(false);
    });

    it("Should increment project count", async function () {
      await vaults.connect(owner).createProject(
        "Project 1",
        "QmHash1",
        ethers.parseUnits("1000", 7),
        fundingPool.address
      );

      expect(await vaults.projectCount()).to.equal(1);

      await vaults.connect(owner).createProject(
        "Project 2",
        "QmHash2",
        ethers.parseUnits("2000", 7),
        fundingPool.address
      );

      expect(await vaults.projectCount()).to.equal(2);
    });

    it("Should revert when non-owner tries to create project", async function () {
      await expect(
        vaults.connect(user1).createProject(
          "Unauthorized Project",
          "QmHash",
          ethers.parseUnits("1000", 7),
          fundingPool.address
        )
      ).to.be.revertedWithCustomError(vaults, "OwnableUnauthorizedAccount");
    });

    it("Should revert with zero funding goal", async function () {
      await expect(
        vaults.connect(owner).createProject(
          "Bad Project",
          "QmHash",
          0,
          fundingPool.address
        )
      ).to.be.revertedWith("Vaults: funding goal must be > 0");
    });

    it("Should revert with zero funding pool address", async function () {
      await expect(
        vaults.connect(owner).createProject(
          "Bad Project",
          "QmHash",
          ethers.parseUnits("1000", 7),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Vaults: funding pool cannot be zero");
    });
  });

  describe("Project Activation", function () {
    beforeEach(async function () {
      await vaults.connect(owner).createProject(
        "Solar Farm",
        "QmHash",
        ethers.parseUnits("10000", 7),
        fundingPool.address
      );
    });

    it("Should allow owner to activate project", async function () {
      await expect(vaults.connect(owner).activateProject(0))
        .to.emit(vaults, "ProjectStateChanged")
        .withArgs(0, 0, 1); // Proposed -> Active

      const project = await vaults.projects(0);
      expect(project.state).to.equal(1); // Active
      expect(project.acceptingStakes).to.equal(true);
    });

    it("Should revert when non-owner tries to activate", async function () {
      await expect(
        vaults.connect(user1).activateProject(0)
      ).to.be.revertedWithCustomError(vaults, "OwnableUnauthorizedAccount");
    });

    it("Should revert when activating non-proposed project", async function () {
      await vaults.connect(owner).activateProject(0);
      
      await expect(
        vaults.connect(owner).activateProject(0)
      ).to.be.revertedWith("Vaults: invalid state");
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await vaults.connect(owner).createProject(
        "Solar Farm",
        "QmHash",
        ethers.parseUnits("1000", 7),
        fundingPool.address
      );
      await vaults.connect(owner).activateProject(0);
    });

    it("Should allow users to stake GBT", async function () {
      const stakeAmount = ethers.parseUnits("100", 7);
      
      await gbtToken.connect(user1).approve(await vaults.getAddress(), stakeAmount);
      
      await expect(vaults.connect(user1).stake(0, stakeAmount))
        .to.emit(vaults, "Staked")
        .withArgs(0, user1.address, stakeAmount, stakeAmount);

      const stake = await vaults.stakes(0, user1.address);
      expect(stake.amount).to.equal(stakeAmount);
      expect(stake.pGBTReceived).to.equal(stakeAmount);

      const project = await vaults.projects(0);
      expect(project.totalStaked).to.equal(stakeAmount);
    });

    it("Should transfer 50% to funding pool", async function () {
      const stakeAmount = ethers.parseUnits("100", 7);
      const expectedTransfer = stakeAmount / 2n;

      await gbtToken.connect(user1).approve(await vaults.getAddress(), stakeAmount);
      
      const balanceBefore = await gbtToken.balanceOf(fundingPool.address);
      await vaults.connect(user1).stake(0, stakeAmount);
      const balanceAfter = await gbtToken.balanceOf(fundingPool.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedTransfer);
    });

    it("Should change state to Funded when goal reached", async function () {
      const fundingGoal = ethers.parseUnits("1000", 7);
      
      await gbtToken.connect(user1).approve(await vaults.getAddress(), fundingGoal);
      
      await vaults.connect(user1).stake(0, fundingGoal);

      const project = await vaults.projects(0);
      expect(project.state).to.equal(2); // Funded
      expect(project.acceptingStakes).to.equal(false);
    });

    it("Should allow multiple users to stake", async function () {
      const stake1 = ethers.parseUnits("300", 7);
      const stake2 = ethers.parseUnits("200", 7);

      await gbtToken.connect(user1).approve(await vaults.getAddress(), stake1);
      await gbtToken.connect(user2).approve(await vaults.getAddress(), stake2);

      await vaults.connect(user1).stake(0, stake1);
      await vaults.connect(user2).stake(0, stake2);

      const project = await vaults.projects(0);
      expect(project.totalStaked).to.equal(stake1 + stake2);
    });

    it("Should revert when project not active", async function () {
      await vaults.connect(owner).createProject(
        "Inactive Project",
        "QmHash2",
        ethers.parseUnits("1000", 7),
        fundingPool.address
      );

      await gbtToken.connect(user1).approve(await vaults.getAddress(), ethers.parseUnits("100", 7));

      await expect(
        vaults.connect(user1).stake(1, ethers.parseUnits("100", 7))
      ).to.be.revertedWith("Vaults: not accepting stakes");
    });

    it("Should revert with zero amount", async function () {
      await expect(
        vaults.connect(user1).stake(0, 0)
      ).to.be.revertedWith("Vaults: amount must be > 0");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await vaults.connect(owner).createProject(
        "Solar Farm",
        "QmHash",
        ethers.parseUnits("10000", 7),
        fundingPool.address
      );
      await vaults.connect(owner).activateProject(0);

      const stakeAmount = ethers.parseUnits("100", 7);
      await gbtToken.connect(user1).approve(await vaults.getAddress(), stakeAmount);
      await vaults.connect(user1).stake(0, stakeAmount);
    });

    it("Should allow unstaking from active project with penalty", async function () {
      const unstakeAmount = ethers.parseUnits("50", 7);
      const penalty = unstakeAmount * 500n / 10000n; // 5%
      const expectedReturn = unstakeAmount - penalty;

      const balanceBefore = await gbtToken.balanceOf(user1.address);

      await expect(vaults.connect(user1).unstake(0, unstakeAmount))
        .to.emit(vaults, "Unstaked")
        .withArgs(0, user1.address, expectedReturn, penalty);

      const balanceAfter = await gbtToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedReturn);

      const stake = await vaults.stakes(0, user1.address);
      expect(stake.amount).to.equal(ethers.parseUnits("50", 7));
    });

    it("Should revert when unstaking more than staked", async function () {
      await expect(
        vaults.connect(user1).unstake(0, ethers.parseUnits("200", 7))
      ).to.be.revertedWith("Vaults: insufficient stake");
    });

    it("Should revert when unstaking from wrong state", async function () {
      // Change to InConstruction state
      await vaults.connect(owner).updateProjectState(0, 3);

      await expect(
        vaults.connect(user1).unstake(0, ethers.parseUnits("50", 7))
      ).to.be.revertedWith("Vaults: cannot unstake in current state");
    });
  });

  describe("KYC Verification", function () {
    it("Should allow KYC verifier to verify users", async function () {
      await expect(vaults.connect(kycVerifier).verifyKYC(user1.address))
        .to.emit(vaults, "KYCVerified")
        .withArgs(user1.address);

      expect(await vaults.kycVerified(user1.address)).to.equal(true);
    });

    it("Should allow owner to verify users", async function () {
      await vaults.connect(owner).verifyKYC(user1.address);
      expect(await vaults.kycVerified(user1.address)).to.equal(true);
    });

    it("Should revert when unauthorized user tries to verify", async function () {
      await expect(
        vaults.connect(user1).verifyKYC(user2.address)
      ).to.be.revertedWith("Vaults: not authorized");
    });
  });

  describe("Parameter Updates", function () {
    it("Should allow owner to update unstake penalty", async function () {
      const newPenalty = 300; // 3%
      await vaults.connect(owner).setUnstakePenalty(newPenalty);
      expect(await vaults.unstakePenaltyBps()).to.equal(newPenalty);
    });

    it("Should revert with penalty > 10%", async function () {
      await expect(
        vaults.connect(owner).setUnstakePenalty(1001)
      ).to.be.revertedWith("Vaults: penalty too high");
    });

    it("Should allow owner to update KYC verifier", async function () {
      await vaults.connect(owner).setKYCVerifier(user1.address);
      expect(await vaults.kycVerifier()).to.equal(user1.address);
    });
  });

  describe("User Stake Info", function () {
    beforeEach(async function () {
      await vaults.connect(owner).createProject(
        "Solar Farm",
        "QmHash",
        ethers.parseUnits("10000", 7),
        fundingPool.address
      );
      await vaults.connect(owner).activateProject(0);

      const stakeAmount = ethers.parseUnits("100", 7);
      await gbtToken.connect(user1).approve(await vaults.getAddress(), stakeAmount);
      await vaults.connect(user1).stake(0, stakeAmount);
    });

    it("Should return correct stake info", async function () {
      const [amount, pGBTReceived, profitsClaimed, debtRepaid, hasConverted, canConvert] =
        await vaults.getUserStake(0, user1.address);

      expect(amount).to.equal(ethers.parseUnits("100", 7));
      expect(pGBTReceived).to.equal(ethers.parseUnits("100", 7));
      expect(profitsClaimed).to.equal(0);
      expect(debtRepaid).to.equal(0);
      expect(hasConverted).to.equal(false);
      expect(canConvert).to.equal(false); // No KYC yet
    });
  });
});