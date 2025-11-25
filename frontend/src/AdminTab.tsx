import { useState } from "react";
import { contractHelpers } from "./useContracts";
import { CONTRACTS } from "./contracts.config";

interface AdminTabProps {
  wallet: any;
  contracts: any;
}

export default function AdminTab({ wallet, contracts }: AdminTabProps) {
  const [newProject, setNewProject] = useState({
    name: "",
    ipfsHash: "",
    fundingGoal: "",
    fundingPool: "",
  });

  const [reserves, setReserves] = useState({
    inferred: "",
    indicated: "",
    measured: "",
    probable: "",
    proven: "",
  });

  const [projectToActivate, setProjectToActivate] = useState("");
  const [loading, setLoading] = useState(false);

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
      const tx = await contracts.vaults.createProject(
        newProject.name,
        newProject.ipfsHash,
        fundingGoalWei,
        newProject.fundingPool
      );
      await tx.wait();
      
      alert(`? Project created successfully!\n\nName: ${newProject.name}`);
      setNewProject({ name: "", ipfsHash: "", fundingGoal: "", fundingPool: "" });
    } catch (error: any) {
      console.error("? Create project error:", error);
      alert(`Failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateProject = async () => {
    if (!wallet.address || !contracts) {
      alert("Please connect your wallet first");
      return;
    }

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

  const handleUpdateReserves = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address || !contracts) {
      alert("Please connect your wallet first");
      return;
    }

    if (!confirm("Update mine reserves?")) return;

    setLoading(true);
    try {
      const reservesData = {
        inferred: reserves.inferred ? contractHelpers.parseGBT(reserves.inferred) : 0n,
        indicated: reserves.indicated ? contractHelpers.parseGBT(reserves.indicated) : 0n,
        measured: reserves.measured ? contractHelpers.parseGBT(reserves.measured) : 0n,
        probable: reserves.probable ? contractHelpers.parseGBT(reserves.probable) : 0n,
        proven: reserves.proven ? contractHelpers.parseGBT(reserves.proven) : 0n,
      };

      const tx = await contracts.minter.updateReserves(reservesData);
      await tx.wait();
      
      // Get new capacity
      const capacity = await contracts.minter.calculateCapacity();
      
      alert(`? Reserves updated!\n\nNew capacity: ${contractHelpers.formatGBT(capacity)} GBT`);
      setReserves({ inferred: "", indicated: "", measured: "", probable: "", proven: "" });
    } catch (error: any) {
      console.error("? Update reserves error:", error);
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
          Manage the Alternun ecosystem on Base blockchain
        </p>
      </div>

      {/* Contract Status */}
      <div className="card" style={{ background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)" }}>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <span style={{ marginRight: "0.75rem" }}>??</span>
          Contract Status
        </h3>
        <div className="grid-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[
            { name: "GBT Token", address: networkContracts.gbtToken },
            { name: "pGBT Token", address: networkContracts.pgbtToken },
            { name: "ePT Token", address: networkContracts.eptToken },
            { name: "Treasury", address: networkContracts.treasury },
            { name: "Minter", address: networkContracts.minter },
            { name: "Project Vaults", address: networkContracts.vaults },
            { name: "Oracle", address: networkContracts.oracle }
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

        <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#1e40af", borderRadius: "8px", border: "1px solid #3b82f6" }}>
          <p className="font-bold text-white">System Status: Live on Base Sepolia</p>
          <p style={{ color: "#bfdbfe", fontSize: "0.875rem" }}>All contracts deployed and operational</p>
        </div>
      </div>

      {/* Create Project */}
      <div className="card" style={{ background: "linear-gradient(135deg, #065f46 0%, #047857 100%)", border: "1px solid #10b981" }}>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <span style={{ marginRight: "0.75rem" }}>???</span>
          Create New Project
        </h3>

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
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={loading || !wallet.address}
          >
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
            <button
              onClick={handleActivateProject}
              className="btn-secondary"
              disabled={loading || !wallet.address || !projectToActivate}
            >
              Activate
            </button>
          </div>
        </div>
      </div>

      {/* Update Reserves */}
      <div className="card" style={{ background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)", border: "1px solid #f59e0b" }}>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <span style={{ marginRight: "0.75rem" }}>??</span>
          Update Mine Reserves (NI 43-101)
        </h3>

        <form onSubmit={handleUpdateReserves} className="space-y-4">
          <div>
            <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              Inferred Resources (grams)
            </label>
            <input
              type="number"
              step="0.0000001"
              value={reserves.inferred}
              onChange={(e) => setReserves({...reserves, inferred: e.target.value})}
              className="input-field"
              placeholder="535400"
              disabled={loading}
            />
            <p style={{ fontSize: "0.75rem", color: "#fef3c7", marginTop: "0.25rem" }}>Weight: 15%</p>
          </div>

          <div className="grid-2">
            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Indicated (grams)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={reserves.indicated}
                onChange={(e) => setReserves({...reserves, indicated: e.target.value})}
                className="input-field"
                placeholder="50000"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 30%</p>
            </div>

            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Measured (grams)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={reserves.measured}
                onChange={(e) => setReserves({...reserves, measured: e.target.value})}
                className="input-field"
                placeholder="25000"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 60%</p>
            </div>

            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Probable (grams)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={reserves.probable}
                onChange={(e) => setReserves({...reserves, probable: e.target.value})}
                className="input-field"
                placeholder="0"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 50%</p>
            </div>

            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Proven (grams)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={reserves.proven}
                onChange={(e) => setReserves({...reserves, proven: e.target.value})}
                className="input-field"
                placeholder="1000"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 70%</p>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={loading || !wallet.address}
          >
            {loading ? "Updating..." : "Update Reserves"}
          </button>
        </form>
      </div>
    </div>
  );
}