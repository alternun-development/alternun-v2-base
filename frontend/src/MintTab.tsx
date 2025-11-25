import { useState, useEffect } from "react";
import { contractHelpers } from "./useContracts";

interface MintTabProps {
  wallet: any;
  contracts: any;
}

export default function MintTab({ wallet, contracts }: MintTabProps) {
  const [amount, setAmount] = useState("1000");
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [gbtOutput, setGbtOutput] = useState<number>(0);
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [gbtBalance, setGbtBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [hasAllowance, setHasAllowance] = useState(false);

  // Load contract data
  useEffect(() => {
    if (!contracts || !wallet.address) return;

    const loadData = async () => {
      try {
        console.log("?? Loading contract data...");
        
        const [price, cap, usdt, gbt] = await Promise.all([
          contracts.oracle.getGoldPrice(),
          contracts.minter.getRemainingCapacity(),
          contracts.usdt.balanceOf(wallet.address),
          contracts.gbtToken.balanceOf(wallet.address),
        ]);

        setGoldPrice(parseFloat(contractHelpers.formatGBT(price)));
        setCapacity(parseFloat(contractHelpers.formatGBT(cap)));
        setUsdtBalance(contractHelpers.formatUSDT(usdt));
        setGbtBalance(contractHelpers.formatGBT(gbt));

        console.log("? Data loaded:", { price: parseFloat(contractHelpers.formatGBT(price)), cap: parseFloat(contractHelpers.formatGBT(cap)) });
      } catch (err) {
        console.error("? Error loading data:", err);
      }
    };

    loadData();
  }, [contracts, wallet.address]);

  // Calculate GBT output
  useEffect(() => {
    if (goldPrice && goldPrice > 0) {
      const amountNum = Number(amount) || 0;
      const fee = amountNum * 0.02;
      const netAmount = amountNum - fee;
      const gbt = netAmount / goldPrice;
      setGbtOutput(gbt);
    }
  }, [amount, goldPrice]);

  // Check allowance
  useEffect(() => {
    if (!contracts || !wallet.address || !amount) return;

    const checkAllowance = async () => {
      try {
        const amountWei = contractHelpers.parseUSDT(amount);
        const allowance = await contracts.usdt.allowance(wallet.address, contracts.addresses.minter);
        setHasAllowance(allowance >= amountWei);
      } catch (err) {
        console.error("Error checking allowance:", err);
        setHasAllowance(false);
      }
    };

    checkAllowance();
  }, [amount, contracts, wallet.address]);

  const handleApprove = async () => {
    if (!amount || approving) return;

    setApproving(true);
    try {
      const amountWei = contractHelpers.parseUSDT(amount);
      const tx = await contracts.usdt.approve(contracts.addresses.minter, amountWei);
      console.log("?? Approving USDT...", tx.hash);
      await tx.wait();
      setHasAllowance(true);
      alert("? USDT approved successfully!");
    } catch (error: any) {
      console.error("? Approval error:", error);
      alert(`Approval failed: ${error.reason || error.message}`);
    } finally {
      setApproving(false);
    }
  };

  const handleMint = async () => {
    if (!amount || loading || !hasAllowance) return;

    if (!confirm(`Mint ${gbtOutput.toFixed(3)} grams of GBT for ${amount} USDT?`)) {
      return;
    }

    setLoading(true);
    try {
      const amountWei = contractHelpers.parseUSDT(amount);
      console.log("?? Minting GBT...", { amount, amountWei: amountWei.toString() });
      
      const tx = await contracts.minter.mint(amountWei);
      console.log("?? Transaction submitted:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("? Transaction confirmed:", receipt);
      
      alert(`? Mint Successful!\n\nGBT Minted: ${gbtOutput.toFixed(3)} grams\n\nTx: ${tx.hash}`);
      
      // Refresh balances
      const [usdt, gbt, cap] = await Promise.all([
        contracts.usdt.balanceOf(wallet.address),
        contracts.gbtToken.balanceOf(wallet.address),
        contracts.minter.getRemainingCapacity(),
      ]);
      setUsdtBalance(contractHelpers.formatUSDT(usdt));
      setGbtBalance(contractHelpers.formatGBT(gbt));
      setCapacity(parseFloat(contractHelpers.formatGBT(cap)));
      
    } catch (error: any) {
      console.error("? Mint error:", error);
      alert(`Mint failed: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Mint Gold-Backed Tokens</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Transform your USD into GBT tokens backed by underground gold reserves from AL-1 Mine.
        </p>
      </div>

      <div className="card">
        <div className="grid-2">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Investment Amount (USD)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontWeight: "500" }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: "32px", fontSize: "1.125rem", fontWeight: "600" }}
                  placeholder="1000"
                />
              </div>
            </div>

            {/* Mine Info */}
            <div style={{
              padding: "12px",
              background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)",
              borderRadius: "8px",
              border: "1px solid #f59e0b"
            }}>
              <div>
                <p className="font-bold text-white" style={{ fontSize: "0.875rem" }}>?? AL-1 Mine</p>
                <p style={{ fontSize: "0.75rem", color: "#fef3c7" }}>
                  Resources: 435.4k grams (Inferred)
                </p>
                <p style={{ fontSize: "0.75rem", color: "#fde68a" }}>
                  Capacity: {capacity !== null ? `${capacity.toFixed(2)} grams mintable` : "Loading..."}
                </p>
              </div>
            </div>

            {/* Wallet Connected */}
            {wallet.address && (
              <div style={{
                padding: "12px",
                background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
                borderRadius: "8px",
                border: "1px solid #10b981"
              }}>
                <div className="flex items-center space-x-4">
                  <div style={{ width: "12px", height: "12px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                  <div>
                    <p className="font-bold text-white">Wallet Connected</p>
                    <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#ccfbf1" }}>
                      {wallet.address.substring(0, 20)}...
                    </p>
                    <p style={{ fontSize: "0.875rem", color: "#d1fae5" }}>
                      Network: Testnet ?
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Approve Button */}
            {!hasAllowance && (
              <button
                onClick={handleApprove}
                className="btn-secondary"
                style={{ width: "100%", padding: "12px", marginBottom: "0.5rem" }}
                disabled={approving || !wallet.address}
              >
                {approving ? "Approving..." : "1. Approve USDT"}
              </button>
            )}

            {/* Mint Button */}
            <button
              onClick={handleMint}
              className="btn-primary"
              style={{ width: "100%", padding: "16px" }}
              disabled={loading || !wallet.address || !hasAllowance}
            >
              {loading ? "Minting..." : hasAllowance ? "2. Mint GBT Tokens" : "Mint GBT Tokens"}
            </button>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Mint Preview {goldPrice && "(Live from Contract)"}
            </h3>
            
            <div className="space-y-4">
              <div className="preview-card">
                <div className="flex justify-between items-center">
                  <span className="text-gray">Gold Price:</span>
                  <span className="text-2xl font-bold text-gold">
                    {goldPrice ? `$${goldPrice.toFixed(2)}/gram` : "Loading..."}
                  </span>
                </div>
                {goldPrice && goldPrice > 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem" }}>
                    ? Live from Oracle Contract
                  </p>
                )}
              </div>

              <div className="grid-2" style={{ gap: "1rem" }}>
                <div className="preview-card">
                  <p style={{ fontSize: "0.875rem", color: "#d1d5db" }}>Fee (2%)</p>
                  <p className="text-xl font-bold" style={{ color: "#ef4444" }}>
                    ${((Number(amount) || 1000) * 0.02).toFixed(2)}
                  </p>
                </div>
                <div className="preview-card">
                  <p style={{ fontSize: "0.875rem", color: "#d1d5db" }}>Net Amount</p>
                  <p className="text-xl font-bold" style={{ color: "#10b981" }}>
                    ${((Number(amount) || 1000) * 0.98).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="preview-card" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", border: "1px solid #14b8a6" }}>
                <div className="text-center">
                  <p style={{ fontSize: "0.875rem", color: "#ccfbf1", fontWeight: "500" }}>GBT Output</p>
                  <p className="text-3xl font-bold text-white">
                    {gbtOutput > 0 ? `${gbtOutput.toFixed(3)} grams` : "Calculating..."}
                  </p>
                </div>
              </div>

              <div className="preview-card" style={{ backgroundColor: "#374151" }}>
                <p style={{ fontSize: "0.75rem", color: "#d1d5db", lineHeight: "1.5" }}>
                  <span className="font-bold">Treasury Distribution:</span><br/>
                  50% Projects ? 30% Recovery ? 20% Alternun
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}