import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AuctionData,
  formatEth,
  formatAddress,
  getTimeRemaining,
  isAuctionActive,
  ipfsToGatewayUrl,
} from "@/lib/auctionUtils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Gavel,
  TrendingUp,
  CheckCircle,
  XCircle,
  Trophy,
  Info,
  Wallet,
} from "lucide-react";

interface AuctionCardProps {
  auction: AuctionData;
  userAddress?: string;
  onBid?: () => void;
  onWithdraw?: () => void;
  onEnd?: () => void;
  isLoading?: boolean;
  userHasBid?: boolean;
  userIsSeller?: boolean;
  userHasPendingReturns?: boolean;
}

interface AuctionMetadata {
  name?: string;
  description?: string;
  condition?: string;
  image?: string;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const AuctionCard = ({
  auction,
  userAddress,
  onBid,
  onWithdraw,
  onEnd,
  isLoading = false,
  userHasBid = false,
  userIsSeller = false,
  userHasPendingReturns = false,
}: AuctionCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [metadata, setMetadata] = useState<AuctionMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  const cleanCID = useMemo(() => {
    return (auction.ipfsCID || "").replace(/"/g, "").trim();
  }, [auction.ipfsCID]);

  const metadataUrl = useMemo(() => {
    return cleanCID ? ipfsToGatewayUrl(cleanCID) : "";
  }, [cleanCID]);

  const isActive = isAuctionActive(auction.deadline, auction.ended);
  const isEnded =
    auction.ended || auction.deadline <= Math.floor(Date.now() / 1000);

  const hasNoBids =
    auction.highestBidder.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  const isHighestBidder =
    !!userAddress &&
    !hasNoBids &&
    auction.highestBidder.toLowerCase() === userAddress.toLowerCase();

  const isWinner = !!userAddress && isEnded && isHighestBidder;

  const isLoser =
    !!userAddress && isEnded && !hasNoBids && !isWinner && userHasBid;

  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(getTimeRemaining(auction.deadline));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [auction.deadline]);

  useEffect(() => {
    const loadMetadataAndImage = async () => {
      if (!metadataUrl) return;

      setImageLoaded(false);
      setImageUrl("");

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
      } catch (error) {
        console.error("Failed to load IPFS metadata/image:", error);

        setMetadata({
          name: auction.itemName,
          image: metadataUrl,
        });
        setImageUrl(metadataUrl);
      }
    };

    loadMetadataAndImage();
  }, [metadataUrl, auction.itemName]);

  const displayName = metadata?.name || auction.itemName;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border/50 bg-card">
      <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-secondary/20">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Gavel className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {imageUrl && (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={displayName}
            className={`w-full h-full object-cover ${
              imageLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity duration-200`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageLoaded(false);
              setImageUrl("");
            }}
          />
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge className={isActive ? "bg-accent/90" : "bg-muted/90"}>
            {isActive ? "Active" : "Ended"}
          </Badge>

          {isWinner && (
            <Badge className="bg-green-500/90 flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              You Won
            </Badge>
          )}

          {isLoser && (
            <Badge className="bg-red-500/90 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              You Lost
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground">
            {displayName}
          </h3>

          <p className="text-xs text-muted-foreground mt-1">
            by {formatAddress(auction.seller)}
          </p>
        </div>

        <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {isEnded ? "Winning Bid" : "Current Highest Bid"}
            </span>

            <span className="text-lg font-bold text-primary">
              {hasNoBids ? "No bids" : `${formatEth(auction.highestBid)} ETH`}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-muted">
            <span className="text-sm text-muted-foreground">
              Starting Price
            </span>

            <span className="text-sm font-semibold">
              {formatEth(auction.startingPrice)} ETH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-secondary" />
          <span>{timeRemaining}</span>
        </div>

        <div className="pt-2 space-y-2">
          {isActive && userAddress && !userIsSeller && !isHighestBidder && (
            <Button onClick={onBid} disabled={isLoading} className="w-full">
              <TrendingUp className="w-4 h-4 mr-2" />
              {isLoading ? "Processing..." : "Place Bid"}
            </Button>
          )}

          {isActive && userIsSeller && (
            <div className="bg-muted/40 text-muted-foreground p-2 rounded text-sm text-center">
              You are the seller
            </div>
          )}

          {isWinner && (
            <div className="bg-green-500/10 text-green-600 p-2 rounded text-sm text-center">
              🎉 You are the winner of this auction
            </div>
          )}

          {isLoser && (
            <div className="bg-red-500/10 text-red-500 p-2 rounded text-sm text-center">
              You lost this auction
            </div>
          )}

          <Link to={`/auction/${auction.id}`} className="block">
            <Button variant="outline" className="w-full">
              <Info className="w-4 h-4 mr-2" />
              Get Auction Info
            </Button>
          </Link>

          {userAddress && !auction.ended && (
            <Button onClick={onEnd} disabled={isLoading} className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              {isLoading ? "Ending..." : "End Auction"}
            </Button>
          )}

          {userAddress && userHasPendingReturns && (
            <Button
              onClick={onWithdraw}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {isLoading ? "Processing..." : "Withdraw Bid"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};