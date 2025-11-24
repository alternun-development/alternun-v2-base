import { expect } from "chai";
import { ethers } from "hardhat";
import { GBTToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GBTToken", function () {
  let gbtToken: GBTToken;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();

    const GBTTokenFactory = await ethers.getContractFactory("GBTToken");
    gbtToken = await GBTTokenFactory.deploy(owner.address);
    await gbtToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await gbtToken.name()).to.equal("Gold-Backed Token");
      expect(await gbtToken.symbol()).to.equal("GBT");
    });

    it("Should have 7 decimals", async function () {
      expect(await gbtToken.decimals()).to.equal(7);
    });

    it("Should start with zero supply", async function () {
      expect(await gbtToken.totalSupply()).to.equal(0);
    });

    it("Should set owner correctly", async function () {
      expect(await gbtToken.owner()).to.equal(owner.address);
    });
  });

  describe("Minter Management", function () {
    it("Should allow owner to set minter", async function () {
      await gbtToken.connect(owner).setMinter(minter.address);
      expect(await gbtToken.minter()).to.equal(minter.address);
    });

    it("Should emit MinterUpdated event", async function () {
      await expect(gbtToken.connect(owner).setMinter(minter.address))
        .to.emit(gbtToken, "MinterUpdated")
        .withArgs(ethers.ZeroAddress, minter.address);
    });

    it("Should revert when non-owner tries to set minter", async function () {
      await expect(
        gbtToken.connect(user).setMinter(minter.address)
      ).to.be.revertedWithCustomError(gbtToken, "OwnableUnauthorizedAccount");
    });

    it("Should revert when setting zero address as minter", async function () {
      await expect(
        gbtToken.connect(owner).setMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("GBT: minter cannot be zero address");
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await gbtToken.connect(owner).setMinter(minter.address);
    });

    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseUnits("100", 7); // 100 GBT with 7 decimals
      
      await gbtToken.connect(minter).mint(user.address, amount);
      
      expect(await gbtToken.balanceOf(user.address)).to.equal(amount);
      expect(await gbtToken.totalSupply()).to.equal(amount);
    });

    it("Should revert when non-minter tries to mint", async function () {
      const amount = ethers.parseUnits("100", 7);
      
      await expect(
        gbtToken.connect(user).mint(user.address, amount)
      ).to.be.revertedWith("GBT: caller is not the minter");
    });

    it("Should revert when minting to zero address", async function () {
      const amount = ethers.parseUnits("100", 7);
      
      await expect(
        gbtToken.connect(minter).mint(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("GBT: mint to zero address");
    });
  });

  describe("Burning", function () {
    const initialAmount = ethers.parseUnits("100", 7);

    beforeEach(async function () {
      await gbtToken.connect(owner).setMinter(minter.address);
      await gbtToken.connect(minter).mint(user.address, initialAmount);
    });

    it("Should allow user to burn their tokens", async function () {
      const burnAmount = ethers.parseUnits("30", 7);
      
      await gbtToken.connect(user).burn(burnAmount);
      
      expect(await gbtToken.balanceOf(user.address)).to.equal(initialAmount - burnAmount);
      expect(await gbtToken.totalSupply()).to.equal(initialAmount - burnAmount);
    });

    it("Should allow burning with approval", async function () {
      const burnAmount = ethers.parseUnits("30", 7);
      
      await gbtToken.connect(user).approve(minter.address, burnAmount);
      await gbtToken.connect(minter).burnFrom(user.address, burnAmount);
      
      expect(await gbtToken.balanceOf(user.address)).to.equal(initialAmount - burnAmount);
    });

    it("Should revert when burning more than balance", async function () {
      const burnAmount = ethers.parseUnits("200", 7);
      
      await expect(
        gbtToken.connect(user).burn(burnAmount)
      ).to.be.revertedWithCustomError(gbtToken, "ERC20InsufficientBalance");
    });
  });

  describe("Decimals precision", function () {
    it("Should correctly represent grams with 7 decimals", async function () {
      // 1 gram = 10,000 token units with 7 decimals
      // 5 grams = 50,000 token units
      const fiveGrams = ethers.parseUnits("5", 7); // This should be 50000000 (5 * 10^7)
      
      await gbtToken.connect(owner).setMinter(minter.address);
      await gbtToken.connect(minter).mint(user.address, fiveGrams);
      
      const balance = await gbtToken.balanceOf(user.address);
      expect(balance).to.equal(fiveGrams);
    });
  });
});