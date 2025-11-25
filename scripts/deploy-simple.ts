import { ethers } from "hardhat";

async function main() {
  console.log("?? Deploying remaining contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const usdtAddress = "0x21db5aD253400eb396100f1E121b4b34bbc32bD6";
  const gbtAddress = "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91";
  const pgbtAddress = "0xa70ccE827C1fD64a9A56b4f92685E521E1c398FC";
  const eptAddress = "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f";

  const INITIAL_GOLD_PRICE = ethers.parseUnits("65.50", 7);
  const FEE_BPS = 200;
  const COMMERCIAL_FACTOR_BPS = 8000;
  const UNSTAKE_PENALTY_BPS = 500;

  // Skip Treasury for now - deploy Oracle
  console.log("1?? Deploying Mock Price Oracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const oracle = await MockPriceOracle.deploy(INITIAL_GOLD_PRICE, deployer.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("? Oracle:", oracleAddress, "\n");

  // Deploy simple treasury placeholder
  console.log("2?? Deploying Treasury (using deployer as treasury)...");
  const treasuryAddress = deployer.address; // Simplified
  console.log("? Treasury:", treasuryAddress, "\n");

  // Deploy Minter
  console.log("3?? Deploying GBT Minter...");
  const GBTMinter = await ethers.getContractFactory("GBTMinter");
  const minter = await GBTMinter.deploy(
    gbtAddress,
    treasuryAddress,
    oracleAddress,
    usdtAddress,
    FEE_BPS,
    COMMERCIAL_FACTOR_BPS,
    deployer.address
  );
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  console.log("? Minter:", minterAddress, "\n");

  // Deploy Vaults
  console.log("4?? Deploying Project Vaults...");
  const ProjectVaults = await ethers.getContractFactory("ProjectVaults");
  const vaults = await ProjectVaults.deploy(
    gbtAddress,
    pgbtAddress,
    eptAddress,
    deployer.address,
    UNSTAKE_PENALTY_BPS,
    deployer.address
  );
  await vaults.waitForDeployment();
  const vaultsAddress = await vaults.getAddress();
  console.log("? Vaults:", vaultsAddress, "\n");

  // Setup permissions
  console.log("5?? Setting permissions...");
  const gbt = await ethers.getContractAt("GBTToken", gbtAddress);
  const pgbt = await ethers.getContractAt("PGBTToken", pgbtAddress);
  const ept = await ethers.getContractAt("EPTToken", eptAddress);
  
  await gbt.setMinter(minterAddress);
  console.log("   ? GBT minter set");
  await pgbt.setMinter(vaultsAddress);
  console.log("   ? pGBT minter set");
  await ept.setMinter(vaultsAddress);
  console.log("   ? ePT minter set\n");

  // Set reserves
  console.log("6?? Setting reserves...");
  await minter.updateReserves({
    inferred: 0,
    indicated: 0,
    measured: 0,
    probable: 0,
    proven: 1000000
  });
  const capacity = await minter.calculateCapacity();
  console.log("? Capacity:", ethers.formatUnits(capacity, 7), "GBT\n");

  console.log("=" .repeat(70));
  console.log("?? DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(70));
  console.log("\n?? Contract Addresses:\n");
  console.log("GBT Token:      ", gbtAddress);
  console.log("pGBT Token:     ", pgbtAddress);
  console.log("ePT Token:      ", eptAddress);
  console.log("Treasury:       ", treasuryAddress, "(deployer)");
  console.log("Oracle:         ", oracleAddress);
  console.log("Minter:         ", minterAddress);
  console.log("Vaults:         ", vaultsAddress);
  console.log("USDT (mock):    ", usdtAddress);

  const deployment = {
    network: "baseSepolia",
    chainId: 84532,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      gbtToken: gbtAddress,
      pgbtToken: pgbtAddress,
      eptToken: eptAddress,
      treasury: treasuryAddress,
      oracle: oracleAddress,
      minter: minterAddress,
      vaults: vaultsAddress,
      usdt: usdtAddress
    }
  };

  const fs = require('fs');
  fs.mkdirSync('./deployments', { recursive: true });
  fs.writeFileSync(
    './deployments/base-sepolia-complete.json',
    JSON.stringify(deployment, null, 2)
  );
  console.log("\n?? Saved to: ./deployments/base-sepolia-complete.json");
  console.log("\n?? View on Basescan:");
  console.log(`https://sepolia.basescan.org/address/${minterAddress}\n`);
}

main().catch(console.error);