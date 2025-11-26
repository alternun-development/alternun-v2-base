import { ethers } from "hardhat";

async function main() {
  console.log("?? Deploying MineRegistry...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy MineRegistry
  console.log("1?? Deploying MineRegistry...");
  const MineRegistry = await ethers.getContractFactory("MineRegistry");
  const mineRegistry = await MineRegistry.deploy(deployer.address);
  await mineRegistry.waitForDeployment();
  const registryAddress = await mineRegistry.getAddress();
  console.log("? MineRegistry:", registryAddress, "\n");

  // Register initial mines
  console.log("2?? Registering initial mines...");
  
  await mineRegistry.registerMine(
    "AL-1 Mine",
    "Colombia",
    "Nechí",
    "Bajo Cauca region, Antioquia",
    "Primary gold mine - Initial registration"
  );
  console.log("? Registered AL-1 Mine (ID: 0)");

  await mineRegistry.registerMine(
    "AL-2 Mine",
    "Colombia",
    "Amalfi",
    "Nordeste Antioqueño",
    "Secondary exploration site"
  );
  console.log("? Registered AL-2 Mine (ID: 1)\n");

  // Add initial NI 43-101 reports
  console.log("3?? Adding NI 43-101 reports...");
  
  const reportDate = Math.floor(Date.now() / 1000);
  
  await mineRegistry.addNI43101Report(
    0, // AL-1
    "QmPlaceholder1", // IPFS hash placeholder
    reportDate,
    "NI43-101-2024-AL1-001",
    ethers.parseUnits("535400", 7), // inferred
    ethers.parseUnits("50000", 7),  // indicated
    ethers.parseUnits("25000", 7),  // measured
    0n,                              // probable
    ethers.parseUnits("1000", 7)    // proven
  );
  console.log("? Added NI 43-101 for AL-1\n");

  console.log("=" .repeat(70));
  console.log("?? DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(70));
  console.log("\nMineRegistry:", registryAddress);
  console.log("\n?? Registered Mines:");
  console.log("  - AL-1 Mine (ID: 0) - Nechí");
  console.log("  - AL-2 Mine (ID: 1) - Amalfi");

  // Update deployment file
  const fs = require('fs');
  const deployment = JSON.parse(fs.readFileSync('./deployments/base-sepolia-complete.json', 'utf8'));
  deployment.contracts.mineRegistry = registryAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync('./deployments/base-sepolia-complete.json', JSON.stringify(deployment, null, 2));
  console.log("\n?? Deployment file updated");
  console.log("?? Update frontend: src/contracts.config.ts\n");
}

main().catch(console.error);