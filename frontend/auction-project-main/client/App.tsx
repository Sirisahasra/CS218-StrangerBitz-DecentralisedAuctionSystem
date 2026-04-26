import "./global.css";

import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useParams,
} from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { WalletProvider, useWallet } from "@/hooks/useWallet";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AuctionData,
  getAuction,
  formatEth,
  formatAddress,
  getTimeRemaining,
  ipfsToGatewayUrl,
} from "@/lib/auctionUtils";

import { ArrowLeft, Gavel } from "lucide-react";

const queryClient = new QueryClient();

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface AuctionMetadata {
  name?: string;
  description?: string;
  condition?: string;
  image?: string;
  createdAt?: string;
}

function AuctionDetailsPage() {
  const { id } = useParams();
  const { provider } = useWallet();

  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [metadata, setMetadata] = useState<AuctionMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  const auctionId = Number(id);

  const metadataUrl = useMemo(() => {
    if (!auction?.ipfsCID) return "";
    return ipfsToGatewayUrl(auction.ipfsCID);
  }, [auction]);

  useEffect(() => {
    const loadAuction = async () => {
      if (!provider || !auctionId) return;

      const data = await getAuction(provider, auctionId);
      setAuction(data);
    };

    loadAuction();
  }, [provider, auctionId]);

  useEffect(() => {
    const loadMetadata = async () => {
      if (!auction || !metadataUrl) return;

      setImageLoaded(false);

      try {
        const response = await fetch(metadataUrl);
        const text = await response.text();

        try {
          const data = JSON.parse(text);

          if (data.image) {
            setMetadata(data);
            setImageUrl(ipfsToGatewayUrl(data.image));
            return;
          }
        } catch {
          // Direct image CID fallback
        }

        setMetadata({
          name: auction.itemName,
          image: metadataUrl,
        });

        setImageUrl(metadataUrl);
      } catch {
        setMetadata({
          name: auction.itemName,
          image: metadataUrl,
        });

        setImageUrl(metadataUrl);
      }
    };

    loadMetadata();
  }, [auction, metadataUrl]);

  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        Loading auction details...
      </div>
    );
  }

  const displayName = metadata?.name || auction.itemName;

  const isEnded =
    auction.ended || auction.deadline <= Math.floor(Date.now() / 1000);

  const hasWinner =
    auction.highestBidder.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Auctions
          </Button>
        </Link>

        <Card className="overflow-hidden border-border/50 bg-card">
          <div className="grid md:grid-cols-2 gap-6 p-6">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Gavel className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={displayName}
                  className={`w-full h-full object-cover ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  } transition-opacity`}
                  onLoad={() => setImageLoaded(true)}
                />
              )}
            </div>

            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
                <p className="text-muted-foreground mt-2">
                  Auction ID: #{auction.id}
                </p>
              </div>

              {metadata?.description && (
                <div>
                  <h2 className="font-semibold mb-1">Description</h2>
                  <p className="text-muted-foreground">
                    {metadata.description}
                  </p>
                </div>
              )}

              {metadata?.condition && (
                <div>
                  <h2 className="font-semibold mb-1">Condition</h2>
                  <p className="text-muted-foreground">{metadata.condition}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Starting Price
                  </p>
                  <p className="font-bold">
                    {formatEth(auction.startingPrice)} ETH
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {isEnded ? "Winning Bid" : "Current Highest Bid"}
                  </p>
                  <p className="font-bold">
                    {auction.highestBid === "0"
                      ? "No bids"
                      : `${formatEth(auction.highestBid)} ETH`}
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-bold">
                    {isEnded ? "Ended" : "Active"}
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Time Remaining
                  </p>
                  <p className="font-bold">
                    {getTimeRemaining(auction.deadline)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Seller: </span>
                  <span className="font-mono">{auction.seller}</span>
                </p>

                {isEnded && (
                  <p>
                    <span className="text-muted-foreground">Winner: </span>
                    <span className="font-mono">
                      {hasWinner ? auction.highestBidder : "No winner"}
                    </span>
                  </p>
                )}

                <p>
                  <span className="text-muted-foreground">
                    Seller Short Address:{" "}
                  </span>
                  {formatAddress(auction.seller)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auction/:id" element={<AuctionDetailsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);