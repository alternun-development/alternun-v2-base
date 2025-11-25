import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("?? Starting Alternun Protocol deployment to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const INITIAL_GOLD_PRICE = ethers.parseUnits("65.50", 7);
  const FEE_BPS = 200;
  const COMMERCIAL_FACTOR_BPS = 8000;
  const UNSTAKE_PENALTY_BPS = 500;

  // Deploy Mock USDT for testing
  console.log("1?? Deploying Mock USDT...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6);
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log("? Mock USDT deployed to:", usdtAddress, "\n");

  // Deploy GBT Token
  console.log("2?? Deploying GBT Token...");
  const GBTToken = await ethers.getContractFactory("GBTToken");
  const gbtToken = await GBTToken.deploy(deployer.address);
  await gbtToken.waitForDeployment();
  const gbtAddress = await gbtToken.getAddress();
  console.log("? GBT Token deployed to:", gbtAddress, "\n");

  // Deploy pGBT Token
  console.log("3?? Deploying pGBT Token...");
  const PGBTToken = await ethers.getContractFactory("PGBTToken");
  const pgbtToken = await PGBTToken.deploy(deployer.address);
  await pgbtToken.waitForDeployment();
  const pgbtAddress = await pgbtToken.getAddress();
  console.log("? pGBT Token deployed to:", pgbtAddress, "\n");

  // Deploy ePT Token
  console.log("4?? Deploying ePT Token...");
  const EPTToken = await ethers.getContractFactory("EPTToken");
  const eptToken = await EPTToken.deploy(deployer.address);
  await eptToken.waitForDeployment();
  const eptAddress = await eptToken.getAddress();
  console.log("? ePT Token deployed to:", eptAddress, "\n");

  // Deploy Treasury Manager (Upgradeable)
  console.log("5?? Deploying Treasury Manager (Upgradeable)...");
  const TreasuryManager = await ethers.getContractFactory("TreasuryManager");
  const treasury = await upgrades.deployProxy(
    TreasuryManager,
    [
      usdtAddress,
      deployer.address,
      deployer.address,
      deployer.address,
      deployer.address
    ],
    { initializer: 'initialize' }
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("? Treasury Manager deployed to:", treasuryAddress, "\n");

  // Deploy Mock Price Oracle
  console.log("6?? Deploying Mock Price Oracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const oracle = await MockPriceOracle.deploy(INITIAL_GOLD_PRICE, deployer.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("? Mock Price Oracle deployed to:", oracleAddress, "\n");

  // Deploy GBT Minter
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
  console.log("? GBT Minter deployed to:", minterAddress, "\n");

  // Deploy Project Vaults
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
  console.log("? Project Vaults deployed to:", vaultsAddress, "\n");

  // Set up permissions
  console.log("9?? Setting up permissions...");
  await gbtToken.setMinter(minterAddress);
  await pgbtToken.setMinter(vaultsAddress);
  await eptToken.setMinter(vaultsAddress);
  console.log("? Permissions configured\n");

  // Set initial reserves
  console.log("?? Setting initial reserves...");
  const reserves = {
    inferred: 0,
    indicated: 0,
    measured: 0,
    probable: 0,
    proven: 1000000
  };
  await minter.updateReserves(reserves);
  const capacity = await minter.calculateCapacity();
  console.log("? Initial reserves set");
  console.log("   Capacity:", ethers.formatUnits(capacity, 7), "GBT\n");

  // Summary
  console.log("=" .repeat(60));
  console.log("?? DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n?? Contract Addresses:\n");
  console.log("GBT Token:          ", gbtAddress);
  console.log("pGBT Token:         ", pgbtAddress);
  console.log("ePT Token:          ", eptAddress);
  console.log("Treasury Manager:   ", treasuryAddress);
  console.log("Mock Price Oracle:  ", oracleAddress);
  console.log("GBT Minter:         ", minterAddress);
  console.log("Project Vaults:     ", vaultsAddress);
  console.log("Mock USDT:          ", usdtAddress);

  // Save addresses to file
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
    `./deployments/base-sepolia-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("\n?? Deployment info saved to ./deployments/\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });