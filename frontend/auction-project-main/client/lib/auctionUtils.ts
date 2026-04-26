import { ethers, Contract, BrowserProvider } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";

export interface AuctionData {
  id: number;
  itemName: string;
  ipfsCID: string;
  seller: string;
  highestBid: string;
  highestBidder: string;
  startingPrice: string;
  deadline: number;
  ended: boolean;
}

export interface CreateAuctionParams {
  itemName: string;
  ipfsCID: string;
  startingPrice: string;
  durationSeconds: number;
}

const PINATA_GATEWAY = "https://salmon-defeated-cow-580.mypinata.cloud/ipfs/";

export const getContractInstance = (signer: ethers.Signer) => {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};

export const getContractInstanceRead = (provider: BrowserProvider) => {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};

export const getAuctionCount = async (provider: BrowserProvider) => {
  const contract = getContractInstanceRead(provider);
  const count = await contract.auctionCount();
  return Number(count);
};

export const getAuction = async (
  provider: BrowserProvider,
  auctionId: number
): Promise<AuctionData | null> => {
  try {
    const contract = getContractInstanceRead(provider);
    const a = await contract.getAuction(auctionId);

    return {
      id: auctionId,
      seller: String(a.seller ?? a[0] ?? ""),
      highestBidder: String(a.highestBidder ?? a[1] ?? ""),
      highestBid: String((a.highestBid ?? a[2] ?? 0n).toString()),
      startingPrice: String((a.startingPrice ?? a[3] ?? 0n).toString()),
      deadline: Number((a.deadline ?? a[4] ?? 0n).toString()),
      ended: Boolean(a.ended ?? a[5] ?? false),

      // New contract does NOT store itemName on-chain.
      // Real item name will come from IPFS metadata in AuctionCard.
      itemName: `Auction #${auctionId}`,

      ipfsCID: String(a.ipfsCID ?? a[6] ?? "").trim(),
    };
  } catch (error) {
    console.error("Error fetching auction:", error);
    return null;
  }
};

export const getAllAuctions = async (
  provider: BrowserProvider
): Promise<AuctionData[]> => {
  try {
    const count = await getAuctionCount(provider);
    const auctions: AuctionData[] = [];

    for (let i = 1; i <= count; i++) {
      const auction = await getAuction(provider, i);
      if (auction) auctions.push(auction);
    }

    return auctions;
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return [];
  }
};

export const createAuction = async (
  signer: ethers.Signer,
  params: CreateAuctionParams
) => {
  try {
    const contract = getContractInstance(signer);
    const startingPriceWei = ethers.parseEther(params.startingPrice);

    // New contract createAuction only accepts:
    // ipfsCID, startingPrice, duration
    const tx = await contract.createAuction(
      params.ipfsCID.trim(),
      startingPriceWei,
      params.durationSeconds
    );

    const receipt = await tx.wait();

    let auctionId: number | undefined;

    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);

          if (parsed?.name === "AuctionCreated") {
            auctionId = Number(parsed.args.auctionId);
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }
    }

    if (auctionId === undefined) {
      const count = await contract.auctionCount();
      auctionId = Number(count);
    }

    return {
      success: true,
      receipt,
      auctionId,
    };
  } catch (error: any) {
    console.error("Error creating auction:", error);

    return {
      success: false,
      error: getReadableError(error),
    };
  }
};

export const placeBid = async (
  signer: ethers.Signer,
  auctionId: number,
  bidAmount: string
) => {
  try {
    const contract = getContractInstance(signer);
    const bidAmountWei = ethers.parseEther(bidAmount);

    const tx = await contract.placeBid(auctionId, {
      value: bidAmountWei,
    });

    const receipt = await tx.wait();

    return {
      success: true,
      receipt,
    };
  } catch (error: any) {
    console.error("Error placing bid:", error);

    return {
      success: false,
      error: getReadableError(error),
    };
  }
};

export const withdrawBid = async (
  signer: ethers.Signer,
  auctionId: number
) => {
  try {
    const contract = getContractInstance(signer);
    const tx = await contract.withdrawBid(auctionId);
    const receipt = await tx.wait();

    return {
      success: true,
      receipt,
    };
  } catch (error: any) {
    console.error("Error withdrawing bid:", error);

    return {
      success: false,
      error: getReadableError(error),
    };
  }
};

export const endAuction = async (
  signer: ethers.Signer,
  auctionId: number
) => {
  try {
    const contract = getContractInstance(signer);
    const tx = await contract.endAuction(auctionId);
    const receipt = await tx.wait();

    return {
      success: true,
      receipt,
    };
  } catch (error: any) {
    console.error("Error ending auction:", error);

    return {
      success: false,
      error: getReadableError(error),
    };
  }
};

export const getPendingReturns = async (
  provider: BrowserProvider,
  auctionId: number,
  userAddress: string
): Promise<bigint> => {
  try {
    const contract = getContractInstanceRead(provider);
    const returns = await contract.getPendingReturn(auctionId, userAddress);
    return BigInt(returns.toString());
  } catch (error) {
    console.error("Error fetching pending returns:", error);
    return 0n;
  }
};

export const formatEth = (weiValue: string | number | bigint): string => {
  try {
    const eth = ethers.formatEther(weiValue);
    const num = parseFloat(eth);

    if (num === 0) return "0";

    return num.toFixed(4).replace(/\.?0+$/, "");
  } catch {
    return "0";
  }
};

export const formatAddress = (address: string): string => {
  if (!address) return "";

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getTimeRemaining = (deadline: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;

  return `${seconds}s`;
};

export const isAuctionActive = (deadline: number, ended: boolean): boolean => {
  if (ended) return false;

  return Math.floor(Date.now() / 1000) < deadline;
};

export const isAuctionDeadlinePassed = (deadline: number): boolean => {
  return Math.floor(Date.now() / 1000) >= deadline;
};

export const canUserEndAuction = (
  auction: AuctionData,
  userAddress?: string
): boolean => {
  if (!userAddress) return false;

  // Button can still be shown from UI, but this function is useful elsewhere.
  return isAuctionDeadlinePassed(auction.deadline) && !auction.ended;
};

export const isUserWinner = (
  auction: AuctionData,
  userAddress?: string
): boolean => {
  if (!userAddress) return false;

  return auction.highestBidder.toLowerCase() === userAddress.toLowerCase();
};

export const ipfsToGatewayUrl = (value?: string): string => {
  if (!value) return "";

  const cleanValue = value.replace(/"/g, "").trim();

  if (cleanValue.startsWith("ipfs://")) {
    return `${PINATA_GATEWAY}${cleanValue.replace("ipfs://", "")}`;
  }

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue;
  }

  return `${PINATA_GATEWAY}${cleanValue}`;
};

const getReadableError = (error: any): string => {
  const message =
    error?.reason ||
    error?.shortMessage ||
    error?.data?.message ||
    error?.message ||
    "Transaction failed";

  if (message.toLowerCase().includes("user rejected")) {
    return "Transaction rejected by user";
  }

  if (message.toLowerCase().includes("insufficient funds")) {
    return "Insufficient ETH";
  }

  if (message.toLowerCase().includes("deadline not reached")) {
    return "Auction deadline not reached";
  }

  return message;
};