import { ethers } from "hardhat";

async function main() {
  console.log("?? Deploying SimpleTreasury and updating Minter...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const usdtAddress = "0x21db5aD253400eb396100f1E121b4b34bbc32bD6";
  const minterAddress = "0x6F23558CeeC59A9D76Bea04faab09c0e8678B483";

  // Deploy SimpleTreasury
  console.log("1?? Deploying SimpleTreasury...");
  const SimpleTreasury = await ethers.getContractFactory("SimpleTreasury");
  const treasury = await SimpleTreasury.deploy(
    usdtAddress,
    deployer.address, // projectPool
    deployer.address, // recoveryPool
    deployer.address, // alternunTreasury
    deployer.address  // owner
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("? SimpleTreasury:", treasuryAddress, "\n");

  // Update Minter treasury address
  console.log("2?? Updating Minter treasury address...");
  const minter = await ethers.getContractAt("GBTMinter", minterAddress);
  await minter.setTreasury(treasuryAddress);
  console.log("? Minter updated\n");

  console.log("=" .repeat(70));
  console.log("?? DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(70));
  console.log("\nNew Treasury:", treasuryAddress);
  console.log("Minter:", minterAddress);
  console.log("\n?? Update frontend with new treasury address");

  // Update deployment file
  const fs = require('fs');
  const deployment = JSON.parse(fs.readFileSync('./deployments/base-sepolia-complete.json', 'utf8'));
  deployment.contracts.treasury = treasuryAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync('./deployments/base-sepolia-complete.json', JSON.stringify(deployment, null, 2));
  console.log("?? Deployment file updated\n");
}

main().catch(console.error);