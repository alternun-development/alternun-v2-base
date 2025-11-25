import { ethers } from "hardhat";

async function main() {
  console.log("?? Redeploying GBTMinter with new Treasury...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const gbtAddress = "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91";
  const treasuryAddress = "0x381556c226b8fCb9f026dcafdf9d44cf78dA54Be";
  const oracleAddress = "0x530C977a22553Ad4140FEa0C137e9e163788DC26";
  const usdtAddress = "0x21db5aD253400eb396100f1E121b4b34bbc32bD6";

  const FEE_BPS = 200;
  const COMMERCIAL_FACTOR_BPS = 8000;

  // Deploy new Minter
  console.log("1?? Deploying new GBT Minter...");
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
  console.log("? New Minter:", minterAddress, "\n");

  // Update GBT minter
  console.log("2?? Updating GBT token minter...");
  const gbt = await ethers.getContractAt("GBTToken", gbtAddress);
  await gbt.setMinter(minterAddress);
  console.log("? GBT minter updated\n");

  // Set reserves
  console.log("3?? Setting reserves...");
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
  console.log("\n?? Updated Addresses:\n");
  console.log("Treasury:       ", treasuryAddress);
  console.log("New Minter:     ", minterAddress);
  console.log("Old Minter:     ", "0x6F23558CeeC59A9D76Bea04faab09c0e8678B483", "(deprecated)");

  // Update deployment file
  const fs = require('fs');
  const deployment = JSON.parse(fs.readFileSync('./deployments/base-sepolia-complete.json', 'utf8'));
  deployment.contracts.treasury = treasuryAddress;
  deployment.contracts.minter = minterAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync('./deployments/base-sepolia-complete.json', JSON.stringify(deployment, null, 2));
  console.log("\n?? Deployment file updated");
  console.log("?? Update frontend: src/contracts.config.ts\n");
}

main().catch(console.error);