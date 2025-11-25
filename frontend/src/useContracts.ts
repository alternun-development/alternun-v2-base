import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACTS, ABIS } from "./contracts.config";

export const useContracts = (
  provider: ethers.BrowserProvider | null,
  signer: ethers.Signer | null,
  chainId: number | null
) => {
  const [contracts, setContracts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initContracts = async () => {
      if (!provider || !signer || !chainId) {
        setContracts(null);
        setLoading(false);
        return;
      }

      try {
        // Determine which network addresses to use
        const isTestnet = chainId === 84532; // Base Sepolia
        const addresses = isTestnet ? CONTRACTS.sepolia : CONTRACTS.mainnet;

        // Initialize contracts
        const gbtToken = new ethers.Contract(addresses.gbtToken, ABIS.gbtToken, signer);
        const pgbtToken = new ethers.Contract(addresses.pgbtToken, ABIS.erc20, signer);
        const eptToken = new ethers.Contract(addresses.eptToken, ABIS.erc20, signer);
        const usdt = new ethers.Contract(addresses.usdt, ABIS.erc20, signer);
        const minter = new ethers.Contract(addresses.minter, ABIS.minter, signer);
        const vaults = new ethers.Contract(addresses.vaults, ABIS.vaults, signer);
        const oracle = new ethers.Contract(addresses.oracle, ABIS.oracle, signer);

        setContracts({
          gbtToken,
          pgbtToken,
          eptToken,
          usdt,
          minter,
          vaults,
          oracle,
          addresses,
        });

        setLoading(false);
      } catch (error) {
        console.error("Error initializing contracts:", error);
        setLoading(false);
      }
    };

    initContracts();
  }, [provider, signer, chainId]);

  return { contracts, loading };
};

// Helper functions for contract interactions
export const contractHelpers = {
  // Format token amounts (7 decimals for GBT/pGBT/ePT)
  formatGBT: (amount: bigint) => ethers.formatUnits(amount, 7),
  parseGBT: (amount: string) => ethers.parseUnits(amount, 7),

  // Format USDT (6 decimals)
  formatUSDT: (amount: bigint) => ethers.formatUnits(amount, 6),
  parseUSDT: (amount: string) => ethers.parseUnits(amount, 6),

  // Format basis points to percentage
  bpsToPercent: (bps: bigint) => Number(bps) / 100,

  // Format timestamp to date
  formatDate: (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  },

  // Project state enum
  projectStates: [
    "Proposed",
    "Active",
    "Funded",
    "InConstruction",
    "Operational",
    "Completed",
    "Failed",
  ],
};