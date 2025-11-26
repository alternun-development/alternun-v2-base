const hre = require("hardhat");

async function main() {
  console.log("?? Creating test project with staking unit...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("?? Using account:", deployer.address);

  const VAULTS_ADDRESS = "0x12F3E1a498B535aA1a578b828C0642D05738E12E";
  const PGBT_ADDRESS = "0x31e3c62a1E79E76D76C8Ce1D2E8D8279D18054EB";

  const vaults = await hre.ethers.getContractAt("ProjectVaults", VAULTS_ADDRESS);
  const pgbtToken = await hre.ethers.getContractAt("PGBTToken", PGBT_ADDRESS);

  // Project details
  const projectName = "Rionegro Solar Farm";
  const ipfsHash = "QmSolarFarmRionegro2025";
  const fundingGoal = hre.ethers.parseUnits("10000", 7); // 10,000 GBT
  const stakingUnit = hre.ethers.parseUnits("5", 7); // 5 GBT per unit
  const fundingPool = deployer.address; // Use deployer as funding pool for now

  console.log("?? Project Details:");
  console.log("   Name:", projectName);
  console.log("   IPFS Hash:", ipfsHash);
  console.log("   Funding Goal:", hre.ethers.formatUnits(fundingGoal, 7), "GBT");
  console.log("   Staking Unit:", hre.ethers.formatUnits(stakingUnit, 7), "GBT");
  console.log("   Funding Pool:", fundingPool);
  console.log();

  console.log("?? Creating project...");
  const tx1 = await vaults.createProject(
    projectName,
    ipfsHash,
    fundingGoal,
    stakingUnit,
    fundingPool
  );
  await tx1.wait();
  console.log("? Project created!");

  const projectCount = await vaults.projectCount();
  const projectId = Number(projectCount) - 1;
  console.log("?? Project ID:", projectId);
  console.log();

  // Get project details
  const project = await vaults.getProject(projectId);
  console.log("?? Project Details from Contract:");
  console.log("   Name:", project.name);
  console.log("   State:", Number(project.state)); // 0 = Proposed
  console.log("   Funding Goal:", hre.ethers.formatUnits(project.fundingGoal, 7), "GBT");
  console.log("   Staking Unit:", hre.ethers.formatUnits(project.stakingUnit, 7), "GBT");
  console.log("   Accepting Stakes:", project.acceptingStakes);
  console.log();

  // Check pGBT metadata
  const metadata = await pgbtToken.getProjectMetadata(projectId);
  console.log("?? pGBT Metadata:");
  console.log("   Name:", metadata.name);
  console.log("   IPFS Hash:", metadata.ipfsHash);
  console.log("   Staking Unit:", hre.ethers.formatUnits(metadata.stakingUnit, 7), "GBT");
  console.log("   Exists:", metadata.exists);
  console.log();

  console.log("?? Activating project...");
  const tx2 = await vaults.activateProject(projectId);
  await tx2.wait();
  console.log("? Project activated!");
  console.log();

  const updatedProject = await vaults.getProject(projectId);
  console.log("?? Updated Project Status:");
  console.log("   State:", Number(updatedProject.state)); // 1 = Active
  console.log("   Accepting Stakes:", updatedProject.acceptingStakes);
  console.log();

  console.log("? Test project created and activated successfully!");
  console.log("\n?? Ready to test staking in frontend!");
  console.log("   - Go to Projects tab");
  console.log("   - You should see 'Rionegro Solar Farm'");
  console.log("   - Staking Unit: 5 GBT");
  console.log("   - Try staking 10 GBT (should receive 2 pGBT units)");
  console.log("   - Try staking 7 GBT (should be rejected - not multiple of 5)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
