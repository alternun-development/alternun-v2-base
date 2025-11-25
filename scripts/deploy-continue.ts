import { ethers } from "hardhat";

async function main() {
  console.log("?? Continuing Alternun deployment (non-upgradeable version)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Existing contracts
  const usdtAddress = "0x21db5aD253400eb396100f1E121b4b34bbc32bD6";
  const gbtAddress = "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91";
  const pgbtAddress = "0xa70ccE827C1fD64a9A56b4f92685E521E1c398FC";
  const eptAddress = "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f";

  const INITIAL_GOLD_PRICE = ethers.parseUnits("65.50", 7);
  const FEE_BPS = 200;
  const COMMERCIAL_FACTOR_BPS = 8000;
  const UNSTAKE_PENALTY_BPS = 500;

  // Deploy Treasury Manager (non-upgradeable)
  console.log("5?? Deploying Treasury Manager (non-upgradeable)...");
  const TreasuryManager = await ethers.getContractFactory("TreasuryManager");
  const treasury = await TreasuryManager.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  
  await treasury.initialize(
    usdtAddress,
    deployer.address,
    deployer.address,
    deployer.address,
    deployer.address
  );
  console.log("? Treasury deployed to:", treasuryAddress, "\n");

  // Deploy Oracle
  console.log("6?? Deploying Mock Price Oracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const oracle = await MockPriceOracle.deploy(INITIAL_GOLD_PRICE, deployer.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("? Oracle deployed to:", oracleAddress, "\n");

  // Deploy Minter
  console.log("7?? Deploying GBT Minter...");
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
  console.log("? Minter deployed to:", minterAddress, "\n");

  // Deploy Vaults
  console.log("8?? Deploying Project Vaults...");
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
  console.log("? Vaults deployed to:", vaultsAddress, "\n");

  // Setup permissions
  console.log("9?? Setting up permissions...");
  const gbt = await ethers.getContractAt("GBTToken", gbtAddress);
  const pgbt = await ethers.getContractAt("PGBTToken", pgbtAddress);
  const ept = await ethers.getContractAt("EPTToken", eptAddress);
  
  await gbt.setMinter(minterAddress);
  await pgbt.setMinter(vaultsAddress);
  await ept.setMinter(vaultsAddress);
  console.log("? Permissions set\n");

  // Set reserves
  console.log("?? Setting reserves...");
  await minter.updateReserves({
    inferred: 0,
    indicated: 0,
    measured: 0,
    probable: 0,
    proven: 1000000
  });
  const capacity = await minter.calculateCapacity();
  console.log("? Capacity:", ethers.formatUnits(capacity, 7), "GBT\n");

  console.log("=" .repeat(60));
  console.log("?? DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\nGBT Token:      ", gbtAddress);
  console.log("pGBT Token:     ", pgbtAddress);
  console.log("ePT Token:      ", eptAddress);
  console.log("Treasury:       ", treasuryAddress);
  console.log("Oracle:         ", oracleAddress);
  console.log("Minter:         ", minterAddress);
  console.log("Vaults:         ", vaultsAddress);
  console.log("USDT:           ", usdtAddress);

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
  fs.writeFileSync(
    `./deployments/base-sepolia-complete.json`,
    JSON.stringify(deployment, null, 2)
  );
  console.log("\n?? Saved to ./deployments/base-sepolia-complete.json\n");
}

main().catch(console.error);