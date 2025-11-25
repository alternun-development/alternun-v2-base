import { useState, useEffect } from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  balance: string | null;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    balance: null,
  });
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  // Base Sepolia chainId = 84532
  // Base Mainnet chainId = 8453
  const BASE_SEPOLIA_CHAIN_ID = 84532;
  const BASE_MAINNET_CHAIN_ID = 8453;

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask not installed! Please install MetaMask to use this app.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(accounts[0]);

      setProvider(provider);
      setSigner(signer);
      setWallet({
        address: accounts[0],
        isConnected: true,
        chainId: Number(network.chainId),
        balance: ethers.formatEther(balance),
      });

      // Check if on Base network
      if (
        Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID &&
        Number(network.chainId) !== BASE_MAINNET_CHAIN_ID
      ) {
        alert(
          "Please switch to Base Sepolia or Base Mainnet in MetaMask.\n\n" +
            "Base Sepolia Chain ID: 84532\n" +
            "Base Mainnet Chain ID: 8453"
        );
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Failed to connect wallet. Please try again.");
    }
  };

  const disconnectWallet = () => {
    setWallet({
      address: null,
      isConnected: false,
      chainId: null,
      balance: null,
    });
    setProvider(null);
    setSigner(null);
  };

  const switchToBaseSepolia = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x14a34" }], // 84532 in hex
      });
    } catch (error: any) {
      // Chain not added, let's add it
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x14a34",
                chainName: "Base Sepolia",
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding Base Sepolia:", addError);
        }
      }
    }
  };

  const switchToBaseMainnet = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }], // 8453 in hex
      });
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x2105",
                chainName: "Base",
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding Base Mainnet:", addError);
        }
      }
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setWallet((prev) => ({
          ...prev,
          address: accounts[0],
        }));
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);

        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const network = await provider.getNetwork();
          const balance = await provider.getBalance(accounts[0]);

          setProvider(provider);
          setSigner(signer);
          setWallet({
            address: accounts[0],
            isConnected: true,
            chainId: Number(network.chainId),
            balance: ethers.formatEther(balance),
          });
        }
      } catch (error) {
        console.error("Error checking connection:", error);
      }
    };

    checkConnection();
  }, []);

  return {
    wallet,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
    switchToBaseSepolia,
    switchToBaseMainnet,
    isBaseSepolia: wallet.chainId === BASE_SEPOLIA_CHAIN_ID,
    isBaseMainnet: wallet.chainId === BASE_MAINNET_CHAIN_ID,
  };
};