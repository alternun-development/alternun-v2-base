const hre = require("hardhat");

async function main() {
  const VAULTS_ADDRESS = "0x12F3E1a498B535aA1a578b828C0642D05738E12E";
  const vaults = await hre.ethers.getContractAt("ProjectVaults", VAULTS_ADDRESS);
  
  const owner = await vaults.owner();
  console.log("Current ProjectVaults owner:", owner);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Your wallet address:", deployer.address);
  
  if (owner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("? You are already the owner!");
  } else {
    console.log("? You are NOT the owner. Ownership needs to be transferred.");
  }
}

main().catch(console.error);
