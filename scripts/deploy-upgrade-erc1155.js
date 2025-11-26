const hre = require("hardhat");

async function main() {
  console.log("?? Starting deployment of pGBT (ERC-1155) and ProjectVaults...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("?? Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("?? Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Existing contracts (keeping these)
  const EXISTING = {
    gbtToken: "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91",
    eptToken: "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f",
    treasury: "0x381556c226b8fCb9f026dcafdf9d44cf78dA54Be",
    minter: "0xE2179CF6fFe3dB4A0d5a473c1E53392d41d8E08f",
    oracle: "0x530C977a22553Ad4140FEa0C137e9e163788DC26",
    mockUSDT: "0x21db5aD253400eb396100f1E121b4b34bbc32bD6",
    mineRegistry: "0x23c7f992b8466c40c2d605C16bA5b0AAd56C19fa"
  };

  console.log("?? Keeping existing contracts:");
  console.log("   GBT Token:", EXISTING.gbtToken);
  console.log("   ePT Token:", EXISTING.eptToken);
  console.log("   Treasury:", EXISTING.treasury);
  console.log("   Minter:", EXISTING.minter);
  console.log("   Oracle:", EXISTING.oracle);
  console.log("   Mock USDT:", EXISTING.mockUSDT);
  console.log("   Mine Registry:", EXISTING.mineRegistry);
  console.log();

  // Deploy new pGBT (ERC-1155)
  console.log("?? Deploying PGBTToken (ERC-1155)...");
  const PGBTToken = await hre.ethers.getContractFactory("PGBTToken");
  const pgbtToken = await PGBTToken.deploy(deployer.address);
  await pgbtToken.waitForDeployment();
  const pgbtAddress = await pgbtToken.getAddress();
  console.log("? PGBTToken deployed to:", pgbtAddress);
  console.log();

  // Deploy new ProjectVaults
  console.log("?? Deploying ProjectVaults...");
  const ProjectVaults = await hre.ethers.getContractFactory("ProjectVaults");
  const vaults = await ProjectVaults.deploy(
    EXISTING.gbtToken,
    pgbtAddress,
    EXISTING.eptToken,
    EXISTING.treasury
  );
  await vaults.waitForDeployment();
  const vaultsAddress = await vaults.getAddress();
  console.log("? ProjectVaults deployed to:", vaultsAddress);
  console.log();

  // Configure pGBT minter
  console.log("??  Setting ProjectVaults as pGBT minter...");
  const tx1 = await pgbtToken.setMinter(vaultsAddress);
  await tx1.wait();
  console.log("? pGBT minter set");
  console.log();

  // Configure ePT minter (ProjectVaults needs to mint ePT)
  console.log("??  Setting ProjectVaults as ePT minter...");
  const eptToken = await hre.ethers.getContractAt("EPTToken", EXISTING.eptToken);
  const tx2 = await eptToken.setMinter(vaultsAddress);
  await tx2.wait();
  console.log("? ePT minter set");
  console.log();

  console.log("?? DEPLOYMENT SUMMARY");
  console.log("==================================================");
  console.log("NEW CONTRACTS:");
  console.log("   pGBT Token (ERC-1155):", pgbtAddress);
  console.log("   ProjectVaults:", vaultsAddress);
  console.log();
  console.log("EXISTING CONTRACTS (unchanged):");
  console.log("   GBT Token:", EXISTING.gbtToken);
  console.log("   ePT Token:", EXISTING.eptToken);
  console.log("   Treasury:", EXISTING.treasury);
  console.log("   Minter:", EXISTING.minter);
  console.log("   Oracle:", EXISTING.oracle);
  console.log("   Mock USDT:", EXISTING.mockUSDT);
  console.log("   Mine Registry:", EXISTING.mineRegistry);
  console.log("==================================================");
  console.log();

  console.log("?? Update frontend contracts.config.ts with:");
  console.log(`
  sepolia: {
    gbtToken: "${EXISTING.gbtToken}",
    pgbtToken: "${pgbtAddress}", // ? UPDATED
    eptToken: "${EXISTING.eptToken}",
    treasury: "${EXISTING.treasury}",
    minter: "${EXISTING.minter}",
    vaults: "${vaultsAddress}", // ? UPDATED
    oracle: "${EXISTING.oracle}",
    mockUSDT: "${EXISTING.mockUSDT}",
    mineRegistry: "${EXISTING.mineRegistry}",
  }
  `);

  console.log("\n? Deployment complete!");
  console.log("\n?? Next steps:");
  console.log("1. Update frontend/src/contracts.config.ts with new addresses");
  console.log("2. Create test project with staking unit");
  console.log("3. Test staking functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
