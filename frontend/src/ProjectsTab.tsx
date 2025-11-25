import { useState, useEffect } from "react";
import { contractHelpers } from "./useContracts";

interface ProjectsTabProps {
  wallet: any;
  contracts: any;
}

const STATE_NAMES = ["Proposed", "Active", "Funded", "InConstruction", "Operational", "Completed", "Failed"];

export default function ProjectsTab({ wallet, contracts }: ProjectsTabProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [userStakes, setUserStakes] = useState<Map<number, any>>(new Map());
  const [activeTab, setActiveTab] = useState<"open" | "construction" | "operational">("open");
  const [loading, setLoading] = useState(true);
  const [stakingProjectId, setStakingProjectId] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (!contracts || !wallet.address) return;

    const loadProjects = async () => {
      try {
        console.log("?? Loading projects...");
        const projectCount = await contracts.vaults.projectCount();
        console.log("Project count:", projectCount.toString());

        const projectsData = [];
        for (let i = 0; i < Number(projectCount); i++) {
          try {
            const project = await contracts.vaults.projects(i);
            console.log("Project", i, ":", project);

            projectsData.push({
              id: i,
              name: project[0],
              ipfsHash: project[1],
              state: Number(project[2]),
              fundingGoal: project[3],
              totalStaked: project[4],
              totalProfits: project[5],
              createdAt: project[6],
              fundedAt: project[7],
              projectOwner: project[8],
              acceptingStakes: project[9],
            });

            // Load user stake
            if (wallet.address) {
              const stake = await contracts.vaults.getUserStake(i, wallet.address);
              if (stake[0] > 0n) {
                userStakes.set(i, {
                  amount: stake[0],
                  pGBTReceived: stake[1],
                  profitsClaimed: stake[2],
                  debtRepaid: stake[3],
                  hasConvertedToEPT: stake[4],
                  canConvertToEPT: stake[5],
                });
              }
            }
          } catch (err) {
            console.error(`Error loading project ${i}:`, err);
          }
        }

        setProjects(projectsData);
        console.log("? Projects loaded:", projectsData);
      } catch (err) {
        console.error("? Error loading projects:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [contracts, wallet.address]);

  const handleStake = async (projectId: number) => {
    if (!wallet.address || !contracts) {
      alert("Please connect your wallet first");
      return;
    }

    const amount = stakeAmount[projectId];
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid stake amount");
      return;
    }

    const amountWei = contractHelpers.parseGBT(amount);
    
    if (!confirm(`Stake ${amount} GBT in this project?\n\nYou will receive ${amount} pGBT in return.`)) {
      return;
    }

    setStakingProjectId(projectId);
    try {
      const allowance = await contracts.gbtToken.allowance(wallet.address, contracts.addresses.vaults);
      if (allowance < amountWei) {
        console.log("?? Approving GBT...");
        const approveTx = await contracts.gbtToken.approve(contracts.addresses.vaults, amountWei);
        await approveTx.wait();
        console.log("? GBT approved");
      }

      console.log("?? Staking GBT...");
      const tx = await contracts.vaults.stake(projectId, amountWei);
      await tx.wait();
      
      alert(`? Successfully staked ${amount} GBT!\n\nYou received ${amount} pGBT`);
      
      // Reload
      window.location.reload();
    } catch (error: any) {
      console.error("? Staking error:", error);
      alert(`Staking failed: ${error.reason || error.message}`);
    } finally {
      setStakingProjectId(null);
    }
  };

  const filterProjects = (tab: string) => {
    return projects.filter(p => {
      if (tab === "open") return p.state === 1 && p.acceptingStakes;
      if (tab === "construction") return p.state === 3;
      if (tab === "operational") return p.state === 4;
      return false;
    });
  };

  const calculateProgress = (project: any) => {
    if (project.fundingGoal === 0n) return 0;
    return Math.min((Number(project.totalStaked) / Number(project.fundingGoal)) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Projects</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Invest in regenerative projects with gold-backed collateral
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        {[
          { key: "open", label: "Open for Staking" },
          { key: "construction", label: "In Construction" },
          { key: "operational", label: "Operational" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontWeight: "600",
              transition: "all 0.3s",
              backgroundColor: activeTab === tab.key ? "#14b8a6" : "#1f2937",
              color: activeTab === tab.key ? "#0f172a" : "#9ca3af",
              border: "none",
              cursor: "pointer",
              boxShadow: activeTab === tab.key ? "0 0 20px rgba(20, 184, 166, 0.3)" : "none"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-white" style={{ padding: "3rem" }}>
          <p>Loading projects...</p>
        </div>
      ) : (
        <div className="grid-2">
          {filterProjects(activeTab).map((project) => {
            const progress = calculateProgress(project);
            const userStake = userStakes.get(project.id);

            return (
              <div key={project.id} className="card">
                <h3 className="text-2xl font-bold text-white mb-4">{project.name}</h3>
                <p className="text-gray mb-4" style={{ fontSize: "0.875rem" }}>
                  {STATE_NAMES[project.state]}
                </p>

                <div style={{ marginBottom: "1rem" }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-white" style={{ fontSize: "0.875rem" }}>
                      {contractHelpers.formatGBT(project.totalStaked)} / {contractHelpers.formatGBT(project.fundingGoal)} GBT
                    </span>
                    <span className="text-alternun font-bold">{progress.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#374151", borderRadius: "4px" }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        backgroundColor: "#14b8a6",
                        borderRadius: "4px",
                      }}
                    ></div>
                  </div>
                </div>

                {userStake && userStake.amount > 0n && (
                  <div className="preview-card mb-4" style={{ backgroundColor: "#1f2937" }}>
                    <h4 className="text-white font-bold mb-2">Your Position</h4>
                    <div className="space-y-1" style={{ fontSize: "0.875rem" }}>
                      <div className="flex justify-between">
                        <span className="text-gray">GBT Staked:</span>
                        <span className="text-white">{contractHelpers.formatGBT(userStake.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray">pGBT Received:</span>
                        <span className="text-alternun">{contractHelpers.formatGBT(userStake.pGBTReceived)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "open" && project.acceptingStakes && (
                  <div className="space-y-3">
                    <input
                      type="number"
                      value={stakeAmount[project.id] || ""}
                      onChange={(e) => setStakeAmount(prev => ({ ...prev, [project.id]: e.target.value }))}
                      placeholder="Amount in GBT"
                      className="input-field"
                      style={{ width: "100%" }}
                    />
                    <button
                      onClick={() => handleStake(project.id)}
                      className="btn-primary"
                      style={{ width: "100%" }}
                      disabled={!wallet.address || stakingProjectId === project.id || !stakeAmount[project.id]}
                    >
                      {!wallet.address
                        ? "Connect Wallet"
                        : stakingProjectId === project.id
                        ? "Staking..."
                        : "Stake GBT"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filterProjects(activeTab).length === 0 && !loading && (
        <div className="text-center text-gray" style={{ padding: "3rem" }}>
          <p style={{ fontSize: "1.125rem" }}>No projects in this category yet</p>
        </div>
      )}
    </div>
  );
}