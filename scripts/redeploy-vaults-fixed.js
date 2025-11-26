const hre = require("hardhat");

async function main() {
  console.log("?? Re-deploying ProjectVaults with correct owner...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("?? Deployer (will be owner):", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("?? Balance:", hre.ethers.formatEther(balance), "ETH\n");

  const ADDRESSES = {
    gbtToken: "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91",
    pgbtToken: "0x31e3c62a1E79E76D76C8Ce1D2E8D8279D18054EB",
    eptToken: "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f",
    treasury: "0x381556c226b8fCb9f026dcafdf9d44cf78dA54Be"
  };

  // Deploy ProjectVaults with deployer as initial owner
  console.log("?? Deploying ProjectVaults...");
  const ProjectVaults = await hre.ethers.getContractFactory("ProjectVaults");
  const vaults = await ProjectVaults.deploy(
    ADDRESSES.gbtToken,
    ADDRESSES.pgbtToken,
    ADDRESSES.eptToken,
    ADDRESSES.treasury
  );
  await vaults.waitForDeployment();
  const vaultsAddress = await vaults.getAddress();
  console.log("? ProjectVaults deployed to:", vaultsAddress);
  
  // Verify owner
  const owner = await vaults.owner();
  console.log("? Owner is:", owner);
  console.log();

  // Configure pGBT minter
  console.log("??  Setting ProjectVaults as pGBT minter...");
  const pgbtToken = await hre.ethers.getContractAt("PGBTToken", ADDRESSES.pgbtToken);
  const tx1 = await pgbtToken.setMinter(vaultsAddress);
  await tx1.wait();
  console.log("? pGBT minter updated");
  console.log();

  // Configure ePT minter
  console.log("??  Setting ProjectVaults as ePT minter...");
  const eptToken = await hre.ethers.getContractAt("EPTToken", ADDRESSES.eptToken);
  const tx2 = await eptToken.setMinter(vaultsAddress);
  await tx2.wait();
  console.log("? ePT minter updated");
  console.log();

  console.log("?? DEPLOYMENT COMPLETE");
  console.log("==================================================");
  console.log("New ProjectVaults address:", vaultsAddress);
  console.log("Owner:", owner);
  console.log("==================================================");
  console.log();

  console.log("?? Update frontend contracts.config.ts:");
  console.log(`vaults: "${vaultsAddress}",`);
  console.log();

  console.log("? Now you can create projects from the Admin panel!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
