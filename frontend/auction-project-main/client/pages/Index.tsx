import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  getAllAuctions,
  AuctionData,
  placeBid,
  withdrawBid,
  endAuction,
  getPendingReturns,
  formatEth,
} from "@/lib/auctionUtils";
import { Header } from "@/components/Header";
import { CreateAuctionForm } from "@/components/CreateAuctionForm";
import { AuctionCard } from "@/components/AuctionCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Sparkles } from "lucide-react";

type AuctionFilter = "all" | "active" | "ended";

interface UserAuctionState {
  [auctionId: number]: {
    hasBid: boolean;
    pendingReturns: bigint;
    isSeller: boolean;
    canWithdraw: boolean;
  };
}

export default function Index() {
  const { account, provider, isCorrectNetwork } = useWallet();

  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [userStates, setUserStates] = useState<UserAuctionState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<AuctionFilter>("all");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const getConnectedAccountSigner = async () => {
    if (!provider || !account) {
      throw new Error("Please connect your wallet");
    }

    const signer = await provider.getSigner(account);
    const address = await signer.getAddress();

    if (address.toLowerCase() !== account.toLowerCase()) {
      throw new Error("MetaMask account mismatch");
    }

    return signer;
  };

  const loadAuctions = async () => {
    if (isLoading) return;
    if (!provider || !isCorrectNetwork) return;

    setIsLoading(true);

    try {
      const allAuctions = await getAllAuctions(provider);
      setAuctions(allAuctions);

      if (account) {
        const states: UserAuctionState = {};

        for (const auction of allAuctions) {
          const pendingReturns = await getPendingReturns(
            provider,
            auction.id,
            account
          );

          const isSeller =
            auction.seller.toLowerCase() === account.toLowerCase();

          const hasBid =
            auction.highestBidder.toLowerCase() === account.toLowerCase() ||
            pendingReturns > 0n;

          states[auction.id] = {
            hasBid,
            pendingReturns,
            isSeller,
            canWithdraw: pendingReturns > 0n,
          };
        }

        setUserStates(states);
      } else {
        setUserStates({});
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load auctions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuctions();
  }, [provider, account, isCorrectNetwork]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));

      if (document.visibilityState === "visible") {
        loadAuctions();
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [provider, account, isCorrectNetwork, isLoading]);

  const activeAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      return !auction.ended && auction.deadline > now;
    });
  }, [auctions, now]);

  const endedAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      return auction.ended || auction.deadline <= now;
    });
  }, [auctions, now]);

  const filteredAuctions = useMemo(() => {
    if (filter === "active") return activeAuctions;
    if (filter === "ended") return endedAuctions;
    return auctions;
  }, [filter, auctions, activeAuctions, endedAuctions]);

  const handleBid = async (auction: AuctionData) => {
    try {
      const signer = await getConnectedAccountSigner();

      const minBid =
        auction.highestBid === "0"
          ? formatEth(auction.startingPrice)
          : formatEth(auction.highestBid);

      const amount = window.prompt(`Bid must be greater than ${minBid} ETH`);

      if (!amount || Number(amount) <= Number(minBid)) {
        toast.error("Invalid bid");
        return;
      }

      setActionLoadingId(auction.id);

      const result = await placeBid(signer, auction.id, amount);

      if (result.success) {
        toast.success("Bid placed");
        await loadAuctions();
      } else {
        toast.error(result.error || "Failed to place bid");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to place bid");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdraw = async (auction: AuctionData) => {
    const state = userStates[auction.id];

    if (!state?.canWithdraw) {
      toast.error("Nothing to withdraw");
      return;
    }

    try {
      const signer = await getConnectedAccountSigner();

      setActionLoadingId(auction.id);

      const result = await withdrawBid(signer, auction.id);

      if (result.success) {
        toast.success("Withdraw successful");
        await loadAuctions();
      } else {
        toast.error(result.error || "Failed to withdraw");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to withdraw");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEnd = async (auction: AuctionData) => {
    try {
      const signer = await getConnectedAccountSigner();

      setActionLoadingId(auction.id);

      const result = await endAuction(signer, auction.id);

      if (result.success) {
        toast.success("Auction ended");
        await loadAuctions();
      } else {
        toast.error(result.error || "Failed to end auction");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to end auction");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-12">
        <section className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full border bg-card">
            <Sparkles className="w-4 h-4 text-primary" />
            Web3 Auction Marketplace
          </div>

          <h1 className="text-6xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Decentralized Auction System
          </h1>
        </section>

        <section className="mb-10">
          <div className="flex justify-between items-center gap-4 bg-card p-4 rounded-xl border">
            <CreateAuctionForm onAuctionCreated={loadAuctions} />

            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All ({auctions.length})
              </Button>

              <Button
                variant={filter === "active" ? "default" : "outline"}
                onClick={() => setFilter("active")}
              >
                Active ({activeAuctions.length})
              </Button>

              <Button
                variant={filter === "ended" ? "default" : "outline"}
                onClick={() => setFilter("ended")}
              >
                Ended ({endedAuctions.length})
              </Button>
            </div>

            <Button
              onClick={() => loadAuctions()}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </section>

        <section>
          {filteredAuctions.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No auctions available
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-6">
              {filteredAuctions.map((auction) => {
                const state = userStates[auction.id];

                return (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    userAddress={account || undefined}
                    onBid={() => handleBid(auction)}
                    onWithdraw={() => handleWithdraw(auction)}
                    onEnd={() => handleEnd(auction)}
                    isLoading={actionLoadingId === auction.id}
                    userHasBid={state?.hasBid || false}
                    userIsSeller={state?.isSeller || false}
                    userHasPendingReturns={state?.canWithdraw || false}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}