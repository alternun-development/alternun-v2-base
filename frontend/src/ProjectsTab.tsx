import { useState, useEffect } from "react";
import { contractHelpers } from "./useContracts";

interface ProjectsTabProps {
  wallet: any;
  contracts: any;
}

export default function ProjectsTab({ wallet, contracts }: ProjectsTabProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAllowance, setHasAllowance] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!contracts) {
      setDataLoading(false);
      return;
    }

    const loadProjects = async () => {
      try {
        console.log("?? Loading projects...");
        const count = await contracts.vaults.projectCount();
        const projectsData = [];

        for (let i = 0; i < Number(count); i++) {
          const project = await contracts.vaults.getProject(i);
          
          // Get pGBT metadata - skip for now
          // const metadata = await contracts.pgbtToken.getProjectMetadata(i);
          
          // Get user stake if wallet connected
          let userStake = null;
          if (wallet.address) {
            userStake = await contracts.vaults.getUserStake(i, wallet.address);
          }

          projectsData.push({
            id: i,
            name: project.name,
            ipfsHash: project.ipfsHash,
            state: Number(project.state),
            fundingGoal: contractHelpers.formatGBT(project.fundingGoal),
            stakingUnit: contractHelpers.formatGBT(project.stakingUnit),
            totalStaked: contractHelpers.formatGBT(project.totalStaked),
            totalProfits: contractHelpers.formatGBT(project.totalProfits),
            acceptingStakes: project.acceptingStakes,
            userStake: userStake ? {
              gbtAmount: contractHelpers.formatGBT(userStake.gbtAmount),
              pGBTUnits: Number(userStake.pGBTUnits),
            } : null,
          });
        }

        setProjects(projectsData);
        console.log("? Projects loaded:", projectsData);
      } catch (err) {
        console.error("? Error loading projects:", err);
      } finally {
        setDataLoading(false);
      }
    };

    loadProjects();
  }, [contracts, wallet.address]);

  useEffect(() => {
    if (!contracts || !wallet.address || !stakeAmount || selectedProject === null) return;

    const checkAllowance = async () => {
      try {
        const amountWei = contractHelpers.parseGBT(stakeAmount);
        const allowance = await contracts.gbtToken.allowance(
          wallet.address,
          contracts.addresses.vaults
        );
        setHasAllowance(allowance >= amountWei);
      } catch (err) {
        console.error("Error checking allowance:", err);
        setHasAllowance(false);
      }
    };

    checkAllowance();
  }, [stakeAmount, selectedProject, contracts, wallet.address]);

  const handleApprove = async () => {
    if (!stakeAmount || selectedProject === null) return;

    setLoading(true);
    try {
      const amountWei = contractHelpers.parseGBT(stakeAmount);
      const tx = await contracts.gbtToken.approve(contracts.addresses.vaults, amountWei);
      console.log("?? Approving GBT...", tx.hash);
      await tx.wait();
      setHasAllowance(true);
      alert("? GBT approved successfully!");
    } catch (error: any) {
      console.error("? Approval error:", error);
      alert(`Approval failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || selectedProject === null || !hasAllowance) return;

    const project = projects[selectedProject];
    const stakingUnit = parseFloat(project.stakingUnit);
    const amount = parseFloat(stakeAmount);

    // CRITICAL: Validate multiple of staking unit
    if (amount % stakingUnit !== 0) {
      alert(
        `? Invalid Amount\n\n` +
        `Staking unit for this project: ${stakingUnit} GBT\n` +
        `Your amount: ${amount} GBT\n\n` +
        `Amount must be an exact multiple of ${stakingUnit}.\n\n` +
        `Valid amounts: ${stakingUnit}, ${stakingUnit * 2}, ${stakingUnit * 3}, etc.`
      );
      return;
    }

    const units = amount / stakingUnit;

    if (!confirm(
      `Stake ${amount} GBT in ${project.name}?\n\n` +
      `You will receive: ${units} pGBT unit${units > 1 ? 's' : ''}\n` +
      `(1 unit = ${stakingUnit} GBT)\n\n` +
      `50% goes to project funding\n` +
      `50% held as reserve`
    )) {
      return;
    }

    setLoading(true);
    try {
      const amountWei = contractHelpers.parseGBT(stakeAmount);
      console.log("?? Staking GBT...", { projectId: selectedProject, amount: stakeAmount });

      const tx = await contracts.vaults.stake(selectedProject, amountWei);
      console.log("?? Transaction submitted:", tx.hash);

      const receipt = await tx.wait();
      console.log("? Transaction confirmed:", receipt);

      alert(
        `? Stake Successful!\n\n` +
        `GBT Staked: ${amount} grams\n` +
        `pGBT Units Received: ${units}\n\n` +
        `Tx: ${tx.hash}`
      );

      // Reload projects
      setDataLoading(true);
      const count = await contracts.vaults.projectCount();
      const projectsData = [];

      for (let i = 0; i < Number(count); i++) {
        const proj = await contracts.vaults.getProject(i);
        const metadata = await contracts.pgbtToken.getProjectMetadata(i);
        let userStake = null;
        if (wallet.address) {
          userStake = await contracts.vaults.getUserStake(i, wallet.address);
        }

        projectsData.push({
          id: i,
          name: proj.name,
          ipfsHash: proj.ipfsHash,
          state: Number(proj.state),
          fundingGoal: contractHelpers.formatGBT(proj.fundingGoal),
          stakingUnit: contractHelpers.formatGBT(proj.stakingUnit),
          totalStaked: contractHelpers.formatGBT(proj.totalStaked),
          totalProfits: contractHelpers.formatGBT(proj.totalProfits),
          acceptingStakes: proj.acceptingStakes,
          userStake: userStake ? {
            gbtAmount: contractHelpers.formatGBT(userStake.gbtAmount),
            pGBTUnits: Number(userStake.pGBTUnits),
          } : null,
        });
      }

      setProjects(projectsData);
      setStakeAmount("");
    } catch (error: any) {
      console.error("? Stake error:", error);
      alert(`Stake failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-alternun mb-4">Regenerative Projects</h2>
          <p className="text-gray">Loading projects...</p>
        </div>
      </div>
    );
  }

  const selectedProjectData = selectedProject !== null ? projects[selectedProject] : null;
  const stakingUnit = selectedProjectData ? parseFloat(selectedProjectData.stakingUnit) : 0;
  const amount = parseFloat(stakeAmount) || 0;
  const isValidMultiple = stakingUnit > 0 && amount > 0 && amount % stakingUnit === 0;
  const unitsToReceive = isValidMultiple ? amount / stakingUnit : 0;

  const projectStates = ["Proposed", "Active", "Funded", "InConstruction", "Operational", "Completed", "Failed"];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Regenerative Projects</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Support real-world sustainability initiatives by staking your GBT tokens.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center" style={{ padding: "3rem" }}>
          <p className="text-gray" style={{ fontSize: "1.125rem" }}>
            No projects available yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {/* Project List */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-4">Available Projects</h3>

            {projects.map((project) => (
              <div
                key={project.id}
                className={`card cursor-pointer transition-all ${
                  selectedProject === project.id ? "ring-2 ring-alternun" : ""
                }`}
                onClick={() => setSelectedProject(project.id)}
                style={{
                  opacity: project.acceptingStakes ? 1 : 0.6,
                  cursor: project.acceptingStakes ? "pointer" : "not-allowed",
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-xl font-bold text-white">{project.name}</h4>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        backgroundColor:
                          project.state === 1 ? "#10b981" : project.state === 2 ? "#f59e0b" : "#6b7280",
                        color: "white",
                        fontWeight: "600",
                      }}
                    >
                      {projectStates[project.state]}
                    </span>
                  </div>
                  {project.acceptingStakes && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "4px 12px",
                        borderRadius: "12px",
                        backgroundColor: "#14b8a6",
                        color: "white",
                        fontWeight: "600",
                      }}
                    >
                      Open for Staking
                    </span>
                  )}
                </div>

                <div className="space-y-2" style={{ fontSize: "0.875rem" }}>
                  <div className="flex justify-between">
                    <span className="text-gray">Staking Unit:</span>
                    <span className="font-bold text-alternun">{project.stakingUnit} GBT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Funding Goal:</span>
                    <span className="font-bold text-white">{project.fundingGoal} GBT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Total Staked:</span>
                    <span className="font-bold text-white">{project.totalStaked} GBT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Progress:</span>
                    <span className="font-bold text-alternun">
                      {((parseFloat(project.totalStaked) / parseFloat(project.fundingGoal)) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {project.userStake && project.userStake.pGBTUnits > 0 && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.5rem",
                        backgroundColor: "rgba(20, 184, 166, 0.1)",
                        borderRadius: "8px",
                        border: "1px solid #14b8a6",
                      }}
                    >
                      <p style={{ fontSize: "0.75rem", color: "#14b8a6", fontWeight: "600" }}>
                        Your Stake: {project.userStake.gbtAmount} GBT
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "#14b8a6" }}>
                        pGBT Units: {project.userStake.pGBTUnits}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Staking Panel */}
          <div className="card">
            {selectedProject === null ? (
              <div className="text-center" style={{ padding: "3rem" }}>
                <p className="text-gray" style={{ fontSize: "1.125rem" }}>
                  Select a project to start staking
                </p>
              </div>
            ) : !selectedProjectData.acceptingStakes ? (
              <div className="text-center" style={{ padding: "3rem" }}>
                <h3 className="text-2xl font-bold text-white mb-4">{selectedProjectData.name}</h3>
                <p className="text-gray" style={{ fontSize: "1.125rem" }}>
                  This project is not currently accepting stakes.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">Stake in {selectedProjectData.name}</h3>

                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#374151",
                    borderRadius: "8px",
                    border: "1px solid #14b8a6",
                  }}
                >
                  <p style={{ fontSize: "0.875rem", color: "#14b8a6", fontWeight: "600", marginBottom: "0.5rem" }}>
                    ?? Staking Unit Information
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "#d1d5db" }}>
                    Staking Unit: <span className="font-bold text-alternun">{stakingUnit} GBT</span>
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                    You'll receive 1 pGBT unit per {stakingUnit} GBT staked.
                    <br />
                    Amount must be exact multiple of {stakingUnit}.
                  </p>
                </div>

                <div>
                  <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    Amount to Stake (GBT)
                  </label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="input-field"
                    placeholder={`Enter multiple of ${stakingUnit}`}
                    step={stakingUnit}
                  />
                  {stakeAmount && !isValidMultiple && (
                    <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.5rem" }}>
                      ?? Amount must be a multiple of {stakingUnit} GBT
                    </p>
                  )}
                  {isValidMultiple && (
                    <p style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.5rem" }}>
                      ? Valid amount - You'll receive {unitsToReceive} pGBT unit{unitsToReceive > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div className="preview-card" style={{ backgroundColor: "#374151" }}>
                  <h4 className="font-bold text-white mb-2">Staking Preview</h4>
                  <div className="space-y-2" style={{ fontSize: "0.875rem" }}>
                    <div className="flex justify-between">
                      <span className="text-gray">GBT Amount:</span>
                      <span className="font-bold text-white">{amount || 0} GBT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray">pGBT Units:</span>
                      <span className="font-bold text-alternun">{unitsToReceive} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray">To Funding:</span>
                      <span className="font-bold text-white">{(amount / 2).toFixed(4)} GBT (50%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray">To Reserve:</span>
                      <span className="font-bold text-white">{(amount / 2).toFixed(4)} GBT (50%)</span>
                    </div>
                  </div>
                </div>

                {!hasAllowance && (
                  <button
                    onClick={handleApprove}
                    className="btn-secondary"
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                    disabled={loading || !wallet.address || !isValidMultiple}
                  >
                    {loading ? "Approving..." : "1. Approve GBT"}
                  </button>
                )}

                <button
                  onClick={handleStake}
                  className="btn-primary"
                  style={{ width: "100%" }}
                  disabled={loading || !wallet.address || !hasAllowance || !isValidMultiple}
                >
                  {loading ? "Staking..." : hasAllowance ? "2. Stake GBT" : "Stake GBT"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
