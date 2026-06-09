import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { createAuction } from "@/lib/auctionUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  ImagePlus,
  UploadCloud,
  Coins,
  Timer,
  FileText,
  BadgeCheck,
  X,
} from "lucide-react";

interface CreateAuctionFormProps {
  onAuctionCreated?: (auctionId: number) => Promise<void>;
}

export const CreateAuctionForm = ({
  onAuctionCreated,
}: CreateAuctionFormProps) => {
  const { signer, account, isCorrectNetwork } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    condition: "",
    startingPrice: "",
    durationMinutes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload PNG, JPG, JPEG, or WEBP image");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const parseJsonResponse = async (response: Response) => {
    const text = await response.text();

    console.log("RAW SERVER RESPONSE:", text);

    if (!text) {
      throw new Error(
        "Server returned empty response. Check if backend server is running."
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server did not return valid JSON. Check backend route.");
    }
  };

  const uploadToPinata = async () => {
    if (!imageFile) {
      throw new Error("Please upload item image");
    }

    const imageFormData = new FormData();
    imageFormData.append("file", imageFile);

    const imageResponse = await fetch("/api/pinata/upload-file", {
      method: "POST",
      body: imageFormData,
    });

    const imageData = await parseJsonResponse(imageResponse);

    if (!imageResponse.ok) {
      throw new Error(imageData?.error || "Image upload failed");
    }

    const imageCID = imageData.cid;

    if (!imageCID) {
      throw new Error("Pinata did not return image CID");
    }

    const metadata = {
      name: formData.itemName.trim(),
      description: formData.description.trim(),
      condition: formData.condition.trim(),
      image: `ipfs://${imageCID}`,
      createdAt: new Date().toISOString(),
    };

    const metadataResponse = await fetch("/api/pinata/upload-json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    const metadataData = await parseJsonResponse(metadataResponse);

    if (!metadataResponse.ok) {
      throw new Error(metadataData?.error || "Metadata upload failed");
    }

    if (!metadataData.cid) {
      throw new Error("Pinata did not return metadata CID");
    }

    return metadataData.cid;
  };

  const resetForm = () => {
    setFormData({
      itemName: "",
      description: "",
      condition: "",
      startingPrice: "",
      durationMinutes: "",
    });

    setImageFile(null);
    setImagePreview("");
  };

  const setQuickDuration = (minutes: string) => {
    setFormData((prev) => ({
      ...prev,
      durationMinutes: minutes,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signer) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Please switch to Sepolia network");
      return;
    }

    if (!formData.itemName.trim()) {
      toast.error("Please enter item name");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter item description");
      return;
    }

    if (!imageFile) {
      toast.error("Please upload item image");
      return;
    }

    if (!formData.startingPrice || parseFloat(formData.startingPrice) <= 0) {
      toast.error("Please enter valid starting price");
      return;
    }

    if (!formData.durationMinutes || parseInt(formData.durationMinutes) <= 0) {
      toast.error("Please enter valid duration");
      return;
    }

    setIsLoading(true);

    try {
      toast.info("Uploading image and item details to IPFS...");

      const metadataCID = await uploadToPinata();

      toast.info("Creating auction on blockchain...");

      const durationSeconds = parseInt(formData.durationMinutes) * 60;

      const result = await createAuction(signer, {
        itemName: formData.itemName.trim(),
        ipfsCID: metadataCID,
        startingPrice: formData.startingPrice,
        durationSeconds,
      });

      if (result.success) {
        await onAuctionCreated?.(result.auctionId ?? 0);

        toast.success("Auction created successfully!");

        resetForm();
        setIsOpen(false);
      } else {
        toast.error(result.error || "Failed to create auction");
      }
    } catch (error: any) {
      console.error("Create auction error:", error);
      toast.error(error.message || "Failed to create auction");
    } finally {
      setIsLoading(false);
    }
  };

  if (!account || !isCorrectNetwork) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-5 py-6 text-base font-semibold shadow-lg hover:opacity-90"
        >
          <Plus className="w-5 h-5" />
          Create Auction
        </Button>
      ) : (
        <Card className="relative overflow-hidden border-border/60 bg-card shadow-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground mb-3">
                  <UploadCloud className="w-3.5 h-3.5" />
                  IPFS + Smart Contract
                </div>

                <h3 className="text-2xl font-bold text-foreground">
                  Create New Auction
                </h3>

                <p className="text-sm text-muted-foreground mt-1">
                  Upload item details, store metadata on IPFS, and publish your
                  auction on-chain.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  resetForm();
                }}
                disabled={isLoading}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2">
                  <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <ImagePlus className="w-4 h-4 text-primary" />
                    Item Image
                  </Label>

                  <label className="group relative flex h-80 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 transition hover:border-primary/70 hover:bg-muted/50">
                    {imagePreview ? (
                      <>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-black/40 opacity-0 transition group-hover:opacity-100 flex items-center justify-center text-white font-semibold">
                          Change Image
                        </div>
                      </>
                    ) : (
                      <div className="text-center px-6">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                          <ImagePlus className="h-7 w-7 text-primary" />
                        </div>

                        <p className="font-semibold text-foreground">
                          Upload item image
                        </p>

                        <p className="text-xs text-muted-foreground mt-2">
                          PNG, JPG, JPEG or WEBP up to 10MB
                        </p>
                      </div>
                    )}

                    <Input
                      id="image"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleImageChange}
                      disabled={isLoading}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="lg:col-span-3 space-y-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="itemName"
                      className="text-sm font-semibold flex items-center gap-2"
                    >
                      <BadgeCheck className="w-4 h-4 text-primary" />
                      Item Name
                    </Label>

                    <Input
                      id="itemName"
                      name="itemName"
                      placeholder="e.g., Vintage Painting"
                      value={formData.itemName}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-12 rounded-xl bg-muted/40 border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-sm font-semibold flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      Description
                    </Label>

                    <textarea
                      id="description"
                      name="description"
                      placeholder="Describe item quality, features, condition, authenticity, etc."
                      value={formData.description}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="w-full min-h-28 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none transition focus:border-primary resize-none"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="condition"
                        className="text-sm font-semibold flex items-center gap-2"
                      >
                        <BadgeCheck className="w-4 h-4 text-primary" />
                        Condition
                      </Label>

                      <Input
                        id="condition"
                        name="condition"
                        placeholder="e.g., New, Used, Excellent"
                        value={formData.condition}
                        onChange={handleChange}
                        disabled={isLoading}
                        className="h-12 rounded-xl bg-muted/40 border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="startingPrice"
                        className="text-sm font-semibold flex items-center gap-2"
                      >
                        <Coins className="w-4 h-4 text-primary" />
                        Starting Price
                      </Label>

                      <div className="relative">
                        <Input
                          id="startingPrice"
                          name="startingPrice"
                          type="number"
                          step="0.0001"
                          placeholder="0.1"
                          value={formData.startingPrice}
                          onChange={handleChange}
                          disabled={isLoading}
                          className="h-12 rounded-xl bg-muted/40 border-border pr-14"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                          ETH
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="durationMinutes"
                      className="text-sm font-semibold flex items-center gap-2"
                    >
                      <Timer className="w-4 h-4 text-primary" />
                      Duration
                    </Label>

                    <div className="grid sm:grid-cols-4 gap-2 mb-2">
                      {[
                        { label: "1 Min", value: "1" },
                        { label: "5 Min", value: "5" },
                        { label: "1 Hour", value: "60" },
                        { label: "1 Day", value: "1440" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={
                            formData.durationMinutes === option.value
                              ? "default"
                              : "outline"
                          }
                          onClick={() => setQuickDuration(option.value)}
                          disabled={isLoading}
                          className="rounded-xl"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>

                    <Input
                      id="durationMinutes"
                      name="durationMinutes"
                      type="number"
                      min="1"
                      placeholder="Or enter custom duration in minutes"
                      value={formData.durationMinutes}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-12 rounded-xl bg-muted/40 border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 py-6 text-base font-semibold hover:opacity-90"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isLoading ? "Creating Auction..." : "Create Auction"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    resetForm();
                  }}
                  disabled={isLoading}
                  className="flex-1 rounded-xl py-6 text-base"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
};
