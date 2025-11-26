import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CONTRACTS, ABIS } from "./contracts.config";

export function useContracts(wallet: any) {
  const [contracts, setContracts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet?.address || !wallet?.chainId) {
      setContracts(null);
      setLoading(false);
      return;
    }

    const initContracts = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const isTestnet = wallet.chainId === 84532;
        const addresses = isTestnet ? CONTRACTS.sepolia : CONTRACTS.mainnet;

        const gbtToken = new ethers.Contract(addresses.gbtToken, ABIS.gbtToken, signer);
        const pgbtToken = new ethers.Contract(addresses.pgbtToken, ABIS.erc20, signer);
        const eptToken = new ethers.Contract(addresses.eptToken, ABIS.erc20, signer);
        const usdt = new ethers.Contract(addresses.usdt, ABIS.erc20, signer);
        const minter = new ethers.Contract(addresses.minter, ABIS.minter, signer);
        const vaults = new ethers.Contract(addresses.vaults, ABIS.vaults, signer);
        const oracle = new ethers.Contract(addresses.oracle, ABIS.oracle, signer);
        const mineRegistry = new ethers.Contract(addresses.mineRegistry, ABIS.mineRegistry, signer);

        setContracts({
          gbtToken,
          pgbtToken,
          eptToken,
          usdt,
          minter,
          vaults,
          oracle,
          mineRegistry,
          addresses,
        });

        setLoading(false);
      } catch (err) {
        console.error("Error initializing contracts:", err);
        setLoading(false);
      }
    };

    initContracts();
  }, [wallet?.address, wallet?.chainId]);

  return { contracts, loading };
}

export const contractHelpers = {
  parseGBT: (amount: string) => ethers.parseUnits(amount, 7),
  formatGBT: (amount: bigint) => ethers.formatUnits(amount, 7),
  parseUSDT: (amount: string) => ethers.parseUnits(amount, 6),
  formatUSDT: (amount: bigint) => ethers.formatUnits(amount, 6),
  bpsToPercent: (bps: bigint) => Number(bps) / 100,
  formatDate: (timestamp: bigint) => new Date(Number(timestamp) * 1000).toLocaleDateString(),
  projectStates: ["Proposed", "Active", "Funded", "InConstruction", "Operational", "Completed", "Failed"],
};