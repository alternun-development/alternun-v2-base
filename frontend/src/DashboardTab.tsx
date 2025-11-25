import { useState, useEffect } from "react";
import { contractHelpers } from "./useContracts";

interface DashboardTabProps {
  wallet: any;
  contracts: any;
}

export default function DashboardTab({ wallet, contracts }: DashboardTabProps) {
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [totalMinted, setTotalMinted] = useState<number | null>(null);
  const [availableCapacity, setAvailableCapacity] = useState<number | null>(null);
  const [gbtBalance, setGbtBalance] = useState<string>("0");
  const [pgbtBalance, setPgbtBalance] = useState<string>("0");
  const [eptBalance, setEptBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contracts) return;

    const loadData = async () => {
      try {
        console.log("?? Loading dashboard data...");

        const [price, minted, capacity] = await Promise.all([
          contracts.oracle.getGoldPrice(),
          contracts.minter.totalMinted(),
          contracts.minter.getRemainingCapacity(),
        ]);

        setGoldPrice(parseFloat(contractHelpers.formatGBT(price)));
        setTotalMinted(parseFloat(contractHelpers.formatGBT(minted)));
        setAvailableCapacity(parseFloat(contractHelpers.formatGBT(capacity)));

        // Load user balances if wallet connected
        if (wallet.address) {
          const [gbt, pgbt, ept] = await Promise.all([
            contracts.gbtToken.balanceOf(wallet.address),
            contracts.pgbtToken.balanceOf(wallet.address),
            contracts.eptToken.balanceOf(wallet.address),
          ]);
          setGbtBalance(contractHelpers.formatGBT(gbt));
          setPgbtBalance(contractHelpers.formatGBT(pgbt));
          setEptBalance(contractHelpers.formatGBT(ept));
        }

        console.log("? Dashboard data loaded");
      } catch (err) {
        console.error("? Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [contracts, wallet.address]);

  const theoreticalCapacity = availableCapacity !== null && totalMinted !== null
    ? availableCapacity + totalMinted
    : 560000;

  const totalPortfolioValue = goldPrice
    ? (parseFloat(gbtBalance) + parseFloat(pgbtBalance)) * goldPrice
    : 0;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">System Dashboard</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Live data from Alternun ecosystem on Base Sepolia
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid-4">
        <div className="preview-card text-center" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", border: "2px solid #14b8a6" }}>
          <div className="text-3xl font-bold text-white mb-2">
            {availableCapacity !== null ? availableCapacity.toFixed(2) : "Loading..."}
          </div>
          <p style={{ color: "#ccfbf1", fontSize: "0.875rem", fontWeight: "600" }}>Available Capacity</p>
          <p style={{ color: "#99f6e4", fontSize: "0.75rem" }}>grams GBT</p>
        </div>

        <div className="preview-card text-center" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", border: "2px solid #f59e0b" }}>
          <div className="text-3xl font-bold text-white mb-2">
            {goldPrice ? `$${goldPrice.toFixed(2)}` : "Loading..."}
          </div>
          <p style={{ color: "#fef3c7", fontSize: "0.875rem", fontWeight: "600" }}>Gold Price</p>
          <p style={{ color: "#fde68a", fontSize: "0.75rem" }}>per gram</p>
        </div>

        <div className="preview-card text-center" style={{ background: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)", border: "2px solid #a855f7" }}>
          <div className="text-3xl font-bold text-white mb-2">
            {totalMinted !== null ? totalMinted.toFixed(2) : "Loading..."}
          </div>
          <p style={{ color: "#f3e8ff", fontSize: "0.875rem", fontWeight: "600" }}>GBT Minted</p>
          <p style={{ color: "#e9d5ff", fontSize: "0.75rem" }}>grams total</p>
        </div>

        <div className="preview-card text-center" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "2px solid #10b981" }}>
          <div className="text-3xl font-bold text-white mb-2">2</div>
          <p style={{ color: "#d1fae5", fontSize: "0.875rem", fontWeight: "600" }}>Active Mines</p>
          <p style={{ color: "#bbf7d0", fontSize: "0.75rem" }}>producing capacity</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Mining Resources Overview */}
        <div className="card">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
            <span style={{ marginRight: "0.75rem" }}>??</span>
            Mining Resources Overview
          </h3>

          <div className="space-y-4">
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#374151", borderRadius: "8px", border: "1px solid #6b7280" }}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Active Mines:</span>
                  <span className="text-alternun font-bold">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Theoretical Capacity:</span>
                  <span className="text-alternun font-bold">{theoreticalCapacity.toFixed(2)} grams</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Already Minted:</span>
                  <span style={{ color: "#a855f7" }} className="font-bold">
                    {totalMinted !== null ? totalMinted.toFixed(2) : "..."} grams
                  </span>
                </div>
                <div className="flex justify-between" style={{ paddingTop: "0.5rem", borderTop: "1px solid #6b7280" }}>
                  <span className="text-white font-bold">Available Now:</span>
                  <span className="text-white font-bold" style={{ fontSize: "1.125rem" }}>
                    {availableCapacity !== null ? availableCapacity.toFixed(2) : "..."} grams
                  </span>
                </div>
              </div>
            </div>

            <h4 className="font-bold text-alternun" style={{ fontSize: "1.125rem" }}>All Mines Summary (NI 43-101)</h4>

            {[
              { label: "Inferred", value: 535.4, weight: "15%", color: "#ef4444" },
              { label: "Indicated", value: 50.0, weight: "30%", color: "#f97316" },
              { label: "Measured", value: 25.0, weight: "60%", color: "#eab308" },
              { label: "Probable", value: 0, weight: "50%", color: "#84cc16" },
              { label: "Proven", value: 1000.0, weight: "70%", color: "#22c55e" }
            ].map((resource) => {
              if (resource.value === 0) return null;
              return (
                <div key={resource.label} className="flex items-center justify-between preview-card">
                  <div className="flex items-center space-x-4">
                    <span style={{
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      borderRadius: "12px",
                      backgroundColor: resource.color,
                      color: "white"
                    }}>
                      {resource.weight}
                    </span>
                    <span className="font-semibold text-white">{resource.label}</span>
                  </div>
                  <span className="font-bold text-alternun">
                    {resource.value.toFixed(1)}k grams
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Your Portfolio */}
        {wallet.address ? (
          <div className="card" style={{ background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)", border: "1px solid #3b82f6" }}>
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <span style={{ marginRight: "0.5rem" }}>??</span>
              Your Portfolio
            </h3>

            <div className="space-y-3">
              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">GBT Balance:</span>
                  <span className="text-gold font-bold">{parseFloat(gbtBalance).toFixed(4)} grams</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">pGBT Balance:</span>
                  <span className="text-alternun font-bold">{parseFloat(pgbtBalance).toFixed(4)} grams</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">ePT Balance:</span>
                  <span style={{ color: "#a855f7" }} className="font-bold">{parseFloat(eptBalance).toFixed(4)}</span>
                </div>
              </div>

              <div style={{ padding: "1rem", backgroundColor: "#10b981", borderRadius: "8px", textAlign: "center", border: "1px solid #059669", marginTop: "1rem" }}>
                <p className="text-white font-bold" style={{ fontSize: "1rem" }}>Total Portfolio Value</p>
                <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: "700" }}>
                  ${totalPortfolioValue.toFixed(2)} USD
                </p>
                <p className="text-white" style={{ fontSize: "0.75rem" }}>
                  ({(parseFloat(gbtBalance) + parseFloat(pgbtBalance)).toFixed(4)} grams total)
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)", border: "1px solid #f59e0b" }}>
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span style={{ marginRight: "0.5rem" }}>??</span>
              Rionegro Solar Farm
            </h3>

            <p className="text-white mb-4" style={{ fontSize: "0.875rem" }}>?? Rionegro, Santander (Zona AL-1)</p>

            <div className="space-y-3">
              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Area:</span>
                  <span className="text-gold font-bold">2 hectáreas</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Solar Panels:</span>
                  <span className="text-gold font-bold">6,000</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Capacity:</span>
                  <span className="text-gold font-bold">2.4 MW</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Annual Production:</span>
                  <span className="text-gold font-bold">3,456 MWh</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Homes Powered:</span>
                  <span className="text-gold font-bold">1,152</span>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">CO2 Offset:</span>
                  <span className="text-gold font-bold">1,728 tons/year</span>
                </div>
              </div>

              <div style={{ padding: "0.75rem", backgroundColor: "rgba(16, 185, 129, 0.2)", borderRadius: "8px", border: "1px solid #10b981" }}>
                <p style={{ fontSize: "0.75rem", color: "#d1fae5", textAlign: "center" }}>
                  Status: <span className="font-bold">Open for Staking</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}