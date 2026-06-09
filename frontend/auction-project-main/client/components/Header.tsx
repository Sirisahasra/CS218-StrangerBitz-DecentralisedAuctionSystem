import { useWallet } from "@/hooks/useWallet";
import { formatAddress } from "@/lib/auctionUtils";
import { Button } from "@/components/ui/button";
import { Gavel, LogOut, Wallet, AlertCircle, Repeat } from "lucide-react";

export const Header = () => {
  const {
    account,
    isConnecting,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    switchAccount,
  } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-primary to-secondary p-2 rounded-lg">
              <Gavel className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              BlockBid
            </h1>
          </div>

          {/* Wallet Section */}
          <div className="flex items-center gap-3">
            {account ? (
              <div className="flex flex-wrap items-center gap-2">
                {!isCorrectNetwork && (
                  <div className="flex items-center gap-2 bg-destructive/20 text-destructive px-3 py-1 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Wrong Network</span>
                    <button
                      onClick={switchToSepolia}
                      className="font-semibold hover:underline ml-1"
                    >
                      Switch
                    </button>
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-lg">
                  <Wallet className="w-4 h-4" />
                  <span className="font-mono text-sm">{formatAddress(account)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={switchAccount}
                  className="gap-2"
                >
                  <Repeat className="w-4 h-4" />
                  <span className="hidden sm:inline">Switch Account</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectWallet}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
