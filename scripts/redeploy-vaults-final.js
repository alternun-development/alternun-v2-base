const hre = require("hardhat");

async function main() {
  console.log("?? Re-deploying ProjectVaults (FIXED)...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("?? Deployer:", deployer.address);

  const ADDRESSES = {
    gbtToken: "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91",
    pgbtToken: "0x31e3c62a1E79E76D76C8Ce1D2E8D8279D18054EB",
    eptToken: "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f",
    treasury: "0x381556c226b8fCb9f026dcafdf9d44cf78dA54Be"
  };

  console.log("?? Deploying ProjectVaults with EXPLICIT owner...");
  const ProjectVaults = await hre.ethers.getContractFactory("ProjectVaults");
  const vaults = await ProjectVaults.deploy(
    ADDRESSES.gbtToken,
    ADDRESSES.pgbtToken,
    ADDRESSES.eptToken,
    deployer.address // ? OWNER as 4th parameter
  );
  await vaults.waitForDeployment();
  const vaultsAddress = await vaults.getAddress();
  console.log("? ProjectVaults deployed to:", vaultsAddress);

  // Wait for deployment to settle
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Verify owner
  const owner = await vaults.owner();
  console.log("? Owner confirmed:", owner);
  console.log();

  // Configure minters
  console.log("??  Configuring minters...");
  const pgbtToken = await hre.ethers.getContractAt("PGBTToken", ADDRESSES.pgbtToken);
  await (await pgbtToken.setMinter(vaultsAddress)).wait();
  
  const eptToken = await hre.ethers.getContractAt("EPTToken", ADDRESSES.eptToken);
  await (await eptToken.setMinter(vaultsAddress)).wait();
  console.log("? Minters configured");
  console.log();

  console.log("?? Update frontend:");
  console.log(`vaults: "${vaultsAddress}",`);
}

main().then(() => process.exit(0)).catch(console.error);
