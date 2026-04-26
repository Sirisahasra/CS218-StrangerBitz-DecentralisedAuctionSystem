import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { ethers, BrowserProvider } from "ethers";
import { SEPOLIA_CHAIN_ID } from "@/lib/contract";
import { toast } from "sonner";

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface WalletContextValue {
  account: string | null;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
  hasMetaMask: boolean;
  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => void;
  switchToSepolia: () => Promise<boolean>;
  switchAccount: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  const hasMetaMask =
    typeof window !== "undefined" && typeof window.ethereum !== "undefined";

  const checkNetwork = useCallback(async () => {
    if (!hasMetaMask) return false;

    try {
      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      const correct = parseInt(chainId, 16) === SEPOLIA_CHAIN_ID;
      setIsCorrectNetwork(correct);
      return correct;
    } catch (error) {
      console.error("Network check error:", error);
      setIsCorrectNetwork(false);
      return false;
    }
  }, [hasMetaMask]);

  const updateProviderAndSigner = useCallback(
    async (selectedAccount?: string) => {
      if (!hasMetaMask) return;

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      const nextSigner = selectedAccount
        ? await browserProvider.getSigner(selectedAccount)
        : await browserProvider.getSigner();

      const signerAddress = await nextSigner.getAddress();

      setSigner(nextSigner);
      setAccount(signerAddress);
    },
    [hasMetaMask]
  );

  const clearWalletState = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setIsCorrectNetwork(false);
    localStorage.removeItem("walletConnected");
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!hasMetaMask) {
      toast.error("MetaMask not found");
      return false;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });

      setIsCorrectNetwork(true);
      return true;
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: "Sepolia",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });

          setIsCorrectNetwork(true);
          return true;
        } catch {
          toast.error("Failed to add Sepolia network");
          return false;
        }
      }

      toast.error("Failed to switch network");
      return false;
    }
  }, [hasMetaMask]);

  const handleConnectedAccounts = useCallback(
    async (accounts: string[] | undefined, showToast = true) => {
      if (!accounts || accounts.length === 0) {
        clearWalletState();
        return false;
      }

      const selectedAccount = accounts[0];

      const correctNetwork = await checkNetwork();

      if (!correctNetwork) {
        const switched = await switchToSepolia();
        if (!switched) return false;
      }

      await updateProviderAndSigner(selectedAccount);

      localStorage.setItem("walletConnected", "true");

      if (showToast) {
        toast.success("Wallet connected successfully");
      }

      return true;
    },
    [checkNetwork, switchToSepolia, updateProviderAndSigner, clearWalletState]
  );

  const connectWallet = useCallback(async () => {
    if (!hasMetaMask) {
      toast.error("MetaMask not found");
      return false;
    }

    setIsConnecting(true);

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      return await handleConnectedAccounts(accounts);
    } catch (error: any) {
      if (error.code !== 4001) {
        toast.error("Failed to connect wallet");
      }

      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [hasMetaMask, handleConnectedAccounts]);

  const disconnectWallet = useCallback(() => {
    clearWalletState();
    toast.success("Wallet disconnected");
  }, [clearWalletState]);

  const switchAccount = useCallback(async () => {
    if (!hasMetaMask) {
      toast.error("MetaMask not found");
      return false;
    }

    setIsConnecting(true);

    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const success = await handleConnectedAccounts(accounts, false);

      if (success) {
        toast.success("Account switched");
        window.location.reload();
      }

      return success;
    } catch (error: any) {
      if (error.code !== 4001) {
        toast.error("Failed to switch account");
      }

      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [hasMetaMask, handleConnectedAccounts]);

  useEffect(() => {
    if (!hasMetaMask) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        clearWalletState();
        return;
      }

      await handleConnectedAccounts(accounts, false);
      window.location.reload();
    };

    const handleChainChanged = async () => {
      await checkNetwork();
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [hasMetaMask, handleConnectedAccounts, checkNetwork, clearWalletState]);

  useEffect(() => {
    const initialize = async () => {
      if (!hasMetaMask) return;

      const wasConnected = localStorage.getItem("walletConnected") === "true";
      if (!wasConnected) return;

      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts && accounts.length > 0) {
          await handleConnectedAccounts(accounts, false);
        }
      } catch (error) {
        console.error("Wallet initialization error:", error);
      }
    };

    initialize();
  }, [hasMetaMask, handleConnectedAccounts]);

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnecting,
        isCorrectNetwork,
        provider,
        signer,
        hasMetaMask,
        connectWallet,
        disconnectWallet,
        switchToSepolia,
        switchAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }

  return context;
};