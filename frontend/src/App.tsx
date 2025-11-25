import { useState } from "react";
import "./App.css";
import { useWallet } from "./useWallet";
import { useContracts } from "./useContracts";
import MintTab from "./MintTab";
import ProjectsTab from "./ProjectsTab";
import DashboardTab from "./DashboardTab";
import AdminTab from "./AdminTab";

function App() {
  const [activeTab, setActiveTab] = useState<"mint" | "projects" | "dashboard" | "admin">("mint");
  
  const {
    wallet,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
    isBaseSepolia,
    isBaseMainnet,
  } = useWallet();

  const { contracts, loading: contractsLoading } = useContracts(provider, signer, wallet.chainId);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="header-gradient" style={{ padding: "1rem 0" }}>
        <div className="max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "1.2rem"
              }}>
                A
              </div>
              <div>
                <h1 className="text-2xl font-bold text-alternun">ALTERNUN</h1>
                <p style={{ fontSize: "0.75rem", color: "#14b8a6", fontWeight: "500" }}>
                  Digital Gold Mining
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <nav className="flex space-x-4">
                {[
                  { key: "mint", label: "Mint GBT" },
                  { key: "projects", label: "Projects" },
                  { key: "dashboard", label: "Dashboard" },
                  { key: "admin", label: "Admin" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      padding: "8px 16px",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: activeTab === tab.key ? "#14b8a6" : "transparent",
                      color: activeTab === tab.key ? "white" : "#d1d5db"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {wallet.isConnected && (
                <div style={{
                  fontSize: "0.75rem",
                  color: "#14b8a6",
                  background: "#374151",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: "1px solid #14b8a6"
                }}>
                  {wallet.address?.substring(0, 8)}...
                </div>
              )}

              <button
                onClick={() => {
                  if (wallet.isConnected) {
                    disconnectWallet();
                  } else {
                    connectWallet();
                  }
                }}
                className="btn-primary"
              >
                {wallet.isConnected ? "Connected ?" : "Connect Wallet"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl py-8 px-4">
        {!wallet.isConnected ? (
          <div className="text-center" style={{ padding: "4rem 0" }}>
            <h2 className="text-4xl font-bold mb-6 text-alternun">Welcome to Alternun</h2>
            <p className="text-gray mb-6" style={{ fontSize: "1.125rem" }}>
              Connect your MetaMask wallet to start minting GBT tokens
              <br />
              backed by underground gold reserves from AL-1 Mine.
            </p>
            <button onClick={connectWallet} className="btn-primary">
              Connect MetaMask
            </button>
          </div>
        ) : !isBaseSepolia && !isBaseMainnet ? (
          <div className="text-center" style={{ padding: "4rem 0" }}>
            <h2 className="text-4xl font-bold mb-6" style={{ color: "#ef4444" }}>Wrong Network</h2>
            <p className="text-gray mb-6" style={{ fontSize: "1.125rem" }}>
              Please switch to Base Sepolia or Base Mainnet
            </p>
          </div>
        ) : contractsLoading ? (
          <div className="text-center" style={{ padding: "4rem 0" }}>
            <p className="text-alternun" style={{ fontSize: "1.125rem" }}>Loading contracts...</p>
          </div>
        ) : (
          <>
            {activeTab === "mint" && <MintTab contracts={contracts} wallet={wallet} />}
            {activeTab === "projects" && <ProjectsTab contracts={contracts} wallet={wallet} />}
            {activeTab === "dashboard" && <DashboardTab contracts={contracts} wallet={wallet} />}
            {activeTab === "admin" && <AdminTab contracts={contracts} wallet={wallet} />}
          </>
        )}
      </main>

      <footer style={{
        marginTop: "4rem",
        padding: "2rem 0",
        textAlign: "center",
        borderTop: "1px solid #374151",
        color: "#9ca3af",
        fontSize: "0.875rem"
      }}>
        Built on Base ? Regenerative Finance Protocol
      </footer>
    </div>
  );
}

export default App;