import { useState, useEffect } from "react";
import { contractHelpers } from "./useContracts";
import { CONTRACTS } from "./contracts.config";

interface AdminTabProps {
  wallet: any;
  contracts: any;
}

export default function AdminTab({ wallet, contracts }: AdminTabProps) {
  const [activeSection, setActiveSection] = useState<"projects" | "mines">("projects");
  const [mineAction, setMineAction] = useState<"new" | "update">("new");
  const [existingMines, setExistingMines] = useState<any[]>([]);
  const [selectedMineId, setSelectedMineId] = useState<string>("");
  const [currentReserves, setCurrentReserves] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Project state
  const [newProject, setNewProject] = useState({
    name: "",
    ipfsHash: "",
    fundingGoal: "",
    stakingUnit: "",
    fundingPool: "",
  });
  const [projectToActivate, setProjectToActivate] = useState("");

  // Mine state - New Mine
  const [newMine, setNewMine] = useState({
    name: "",
    country: "",
    municipality: "",
    location: "",
    notes: "",
  });

  // Mine state - Update/Report
  const [niReport, setNiReport] = useState({
    reportNumber: "",
    reportDate: "",
    ipfsHash: "QmPlaceholder",
    inferred: "",
    indicated: "",
    measured: "",
    probable: "",
    proven: "",
  });

  useEffect(() => {
    if (!contracts) return;

    const loadMines = async () => {
      try {
        const mineCount = await contracts.mineRegistry.mineCount();
        const mines = [];

        for (let i = 0; i < Number(mineCount); i++) {
          const mine = await contracts.mineRegistry.getMine(i);
          mines.push({ id: i, ...mine });
        }

        setExistingMines(mines);
      } catch (err) {
        console.error("Error loading mines:", err);
      }
    };

    loadMines();
  }, [contracts]);

  useEffect(() => {
    if (!contracts || !selectedMineId || mineAction !== "update") return;

    const loadReserves = async () => {
      try {
        const mineId = parseInt(selectedMineId);
        const reportCount = await contracts.mineRegistry.getReportCount(mineId);

        if (Number(reportCount) > 0) {
          const reserves = await contracts.mineRegistry.getLatestReserves(mineId);
          setCurrentReserves({
            inferred: contractHelpers.formatGBT(reserves[0]),
            indicated: contractHelpers.formatGBT(reserves[1]),
            measured: contractHelpers.formatGBT(reserves[2]),
            probable: contractHelpers.formatGBT(reserves[3]),
            proven: contractHelpers.formatGBT(reserves[4]),
          });
        } else {
          setCurrentReserves({
            inferred: "0",
            indicated: "0",
            measured: "0",
            probable: "0",
            proven: "0",
          });
        }
      } catch (err) {
        console.error("Error loading reserves:", err);
      }
    };

    loadReserves();
  }, [selectedMineId, mineAction, contracts]);

  const calculateDifference = () => {
    if (!currentReserves) return null;

    return {
      inferred: (parseFloat(niReport.inferred || "0") - parseFloat(currentReserves.inferred)).toFixed(4),
      indicated: (parseFloat(niReport.indicated || "0") - parseFloat(currentReserves.indicated)).toFixed(4),
      measured: (parseFloat(niReport.measured || "0") - parseFloat(currentReserves.measured)).toFixed(4),
      probable: (parseFloat(niReport.probable || "0") - parseFloat(currentReserves.probable)).toFixed(4),
      proven: (parseFloat(niReport.proven || "0") - parseFloat(currentReserves.proven)).toFixed(4),
    };
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address || !contracts) {
      alert("Please connect your wallet first");
      return;
    }

    if (!confirm(`Create project "${newProject.name}"?`)) return;

    setLoading(true);
    try {
      const fundingGoalWei = contractHelpers.parseGBT(newProject.fundingGoal);
      const stakingUnitWei = contractHelpers.parseGBT(newProject.stakingUnit);
      
      const tx = await contracts.vaults.createProject(
        newProject.name,
        newProject.ipfsHash,
        fundingGoalWei,
        stakingUnitWei,
        newProject.fundingPool
      );
      await tx.wait();

      alert(`? Project created successfully!\n\nName: ${newProject.name}`);
      setNewProject({ name: "", ipfsHash: "", fundingGoal: "", stakingUnit: "", fundingPool: "" });
    } catch (error: any) {
      console.error("? Create project error:", error);
      alert(`Failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateProject = async () => {
    if (!wallet.address || !contracts) return;

    const projectId = parseInt(projectToActivate);
    if (isNaN(projectId)) {
      alert("Please enter a valid project ID");
      return;
    }

    if (!confirm(`Activate project #${projectId}?`)) return;

    setLoading(true);
    try {
      const tx = await contracts.vaults.activateProject(projectId);
      await tx.wait();

      alert(`? Project #${projectId} activated!`);
      setProjectToActivate("");
    } catch (error: any) {
      console.error("? Activate project error:", error);
      alert(`Failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterNewMine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address || !contracts) return;

    const confirmMessage = `Register new mine:\n\nName: ${newMine.name}\nCountry: ${newMine.country}\nMunicipality: ${newMine.municipality}\n\nConfirm?`;
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const tx1 = await contracts.mineRegistry.registerMine(
        newMine.name,
        newMine.country,
        newMine.municipality,
        newMine.location,
        newMine.notes
      );
      await tx1.wait();

      const mineCount = await contracts.mineRegistry.mineCount();
      const newMineId = Number(mineCount) - 1;

      const reportDate = Math.floor(new Date(niReport.reportDate).getTime() / 1000);

      const tx2 = await contracts.mineRegistry.addNI43101Report(
        newMineId,
        niReport.ipfsHash,
        reportDate,
        niReport.reportNumber,
        contractHelpers.parseGBT(niReport.inferred || "0"),
        contractHelpers.parseGBT(niReport.indicated || "0"),
        contractHelpers.parseGBT(niReport.measured || "0"),
        contractHelpers.parseGBT(niReport.probable || "0"),
        contractHelpers.parseGBT(niReport.proven || "0")
      );
      await tx2.wait();

      const tx3 = await contracts.minter.updateReserves({
        inferred: contractHelpers.parseGBT(niReport.inferred || "0"),
        indicated: contractHelpers.parseGBT(niReport.indicated || "0"),
        measured: contractHelpers.parseGBT(niReport.measured || "0"),
        probable: contractHelpers.parseGBT(niReport.probable || "0"),
        proven: contractHelpers.parseGBT(niReport.proven || "0"),
      });
      await tx3.wait();

      alert(`? Mine registered successfully!\n\nMine ID: ${newMineId}\nName: ${newMine.name}`);

      setNewMine({ name: "", country: "", municipality: "", location: "", notes: "" });
      setNiReport({ reportNumber: "", reportDate: "", ipfsHash: "QmPlaceholder", inferred: "", indicated: "", measured: "", probable: "", proven: "" });

      window.location.reload();
    } catch (error: any) {
      console.error("? Register mine error:", error);
      alert(`Failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address || !contracts || !selectedMineId) return;

    const diff = calculateDifference();
    if (!diff) return;

    const confirmMessage = `Update mine reserves:\n\nCurrent ? New (Difference)\n\nInferred: ${currentReserves.inferred} ? ${niReport.inferred} (${diff.inferred})\nIndicated: ${currentReserves.indicated} ? ${niReport.indicated} (${diff.indicated})\nMeasured: ${currentReserves.measured} ? ${niReport.measured} (${diff.measured})\nProbable: ${currentReserves.probable} ? ${niReport.probable} (${diff.probable})\nProven: ${currentReserves.proven} ? ${niReport.proven} (${diff.proven})\n\nConfirm?`;

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const mineId = parseInt(selectedMineId);
      const reportDate = Math.floor(new Date(niReport.reportDate).getTime() / 1000);

      const tx1 = await contracts.mineRegistry.addNI43101Report(
        mineId,
        niReport.ipfsHash,
        reportDate,
        niReport.reportNumber,
        contractHelpers.parseGBT(niReport.inferred || "0"),
        contractHelpers.parseGBT(niReport.indicated || "0"),
        contractHelpers.parseGBT(niReport.measured || "0"),
        contractHelpers.parseGBT(niReport.probable || "0"),
        contractHelpers.parseGBT(niReport.proven || "0")
      );
      await tx1.wait();

      const tx2 = await contracts.minter.updateReserves({
        inferred: contractHelpers.parseGBT(niReport.inferred || "0"),
        indicated: contractHelpers.parseGBT(niReport.indicated || "0"),
        measured: contractHelpers.parseGBT(niReport.measured || "0"),
        probable: contractHelpers.parseGBT(niReport.probable || "0"),
        proven: contractHelpers.parseGBT(niReport.proven || "0"),
      });
      await tx2.wait();

      alert(`? Mine updated successfully!\n\nMine ID: ${mineId}\nNew capacity calculated`);

      setNiReport({ reportNumber: "", reportDate: "", ipfsHash: "QmPlaceholder", inferred: "", indicated: "", measured: "", probable: "", proven: "" });
      setSelectedMineId("");
      setCurrentReserves(null);
    } catch (error: any) {
      console.error("? Update mine error:", error);
      alert(`Failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const networkContracts = wallet.chainId === 84532 ? CONTRACTS.sepolia : CONTRACTS.mainnet;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Administration Panel</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Manage Alternun ecosystem on Base blockchain
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <button
          onClick={() => setActiveSection("projects")}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "0.5rem",
            fontWeight: "600",
            backgroundColor: activeSection === "projects" ? "#14b8a6" : "#1f2937",
            color: activeSection === "projects" ? "#0f172a" : "#9ca3af",
            border: "none",
            cursor: "pointer",
          }}
        >
          Project Management
        </button>
        <button
          onClick={() => setActiveSection("mines")}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "0.5rem",
            fontWeight: "600",
            backgroundColor: activeSection === "mines" ? "#14b8a6" : "#1f2937",
            color: activeSection === "mines" ? "#0f172a" : "#9ca3af",
            border: "none",
            cursor: "pointer",
          }}
        >
          Mine Management
        </button>
      </div>

      {activeSection === "projects" && (
        <>
          <div className="card" style={{ background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)" }}>
            <h3 className="text-2xl font-bold text-white mb-6">?? Contract Status</h3>
            <div className="grid-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {[
                { name: "GBT Token", address: networkContracts.gbtToken },
                { name: "pGBT Token", address: networkContracts.pgbtToken },
                { name: "ePT Token", address: networkContracts.eptToken },
                { name: "Treasury", address: networkContracts.treasury },
                { name: "Minter", address: networkContracts.minter },
                { name: "Vaults", address: networkContracts.vaults },
                { name: "Oracle", address: networkContracts.oracle },
                { name: "Mine Registry", address: networkContracts.mineRegistry },
              ].map((contract) => (
                <div key={contract.name} className="preview-card">
                  <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#d1d5db" }}>{contract.name}</span>
                    <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                  </div>
                  <p style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "#6b7280", wordBreak: "break-all" }}>
                    {contract.address.substring(0, 12)}...
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: "linear-gradient(135deg, #065f46 0%, #047857 100%)", border: "1px solid #10b981" }}>
            <h3 className="text-2xl font-bold text-white mb-6">? Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="input-field"
                  placeholder="e.g., Solar Farm Amalfi"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  IPFS Hash *
                </label>
                <input
                  type="text"
                  value={newProject.ipfsHash}
                  onChange={(e) => setNewProject({...newProject, ipfsHash: e.target.value})}
                  className="input-field"
                  placeholder="QmXXXXXXXXXXXXXXXXXXXXXX"
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    Funding Goal (GBT) *
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={newProject.fundingGoal}
                    onChange={(e) => setNewProject({...newProject, fundingGoal: e.target.value})}
                    className="input-field"
                    placeholder="10000"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    Staking Unit (GBT) *
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={newProject.stakingUnit}
                    onChange={(e) => setNewProject({...newProject, stakingUnit: e.target.value})}
                    className="input-field"
                    placeholder="5"
                    required
                    disabled={loading}
                  />
                  <p style={{ fontSize: "0.75rem", color: "#d1fae5", marginTop: "0.25rem" }}>
                    Users receive 1 pGBT per staking unit
                  </p>
                </div>
              </div>

              <div>
                <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  Funding Pool Address *
                </label>
                <input
                  type="text"
                  value={newProject.fundingPool}
                  onChange={(e) => setNewProject({...newProject, fundingPool: e.target.value})}
                  className="input-field"
                  placeholder="0x..."
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading || !wallet.address}>
                {loading ? "Creating..." : "Create Project"}
              </button>
            </form>

            <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}>
              <h4 className="text-white font-bold mb-2">Activate Project</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={projectToActivate}
                  onChange={(e) => setProjectToActivate(e.target.value)}
                  className="input-field"
                  placeholder="Project ID"
                  style={{ flex: 1 }}
                  disabled={loading}
                />
                <button onClick={handleActivateProject} className="btn-secondary" disabled={loading || !wallet.address || !projectToActivate}>
                  Activate
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSection === "mines" && (
        <div className="card" style={{ background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)", border: "1px solid #f59e0b" }}>
          <h3 className="text-2xl font-bold text-white mb-6">?? Mine Management</h3>
          <p className="text-white" style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Mine management section temporarily simplified for this demo. Full functionality coming soon.
          </p>
        </div>
      )}
    </div>
  );
}