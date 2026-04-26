import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { createAuction } from "@/lib/auctionUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

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
          className="gap-2 bg-gradient-to-r from-secondary to-accent hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Create Auction
        </Button>
      ) : (
        <Card className="p-6 border-border/50 bg-card">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Create New Auction
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemName" className="text-sm font-medium">
                Item Name
              </Label>

              <Input
                id="itemName"
                name="itemName"
                placeholder="e.g., Vintage Painting"
                value={formData.itemName}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>

              <textarea
                id="description"
                name="description"
                placeholder="Describe item quality, features, condition, etc."
                value={formData.description}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full min-h-24 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition" className="text-sm font-medium">
                Condition
              </Label>

              <Input
                id="condition"
                name="condition"
                placeholder="e.g., New, Used, Excellent"
                value={formData.condition}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image" className="text-sm font-medium">
                Item Image
              </Label>

              <Input
                id="image"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleImageChange}
                disabled={isLoading}
                className="bg-muted/50 border-border"
              />

              {imagePreview && (
                <div className="mt-2 h-40 rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startingPrice" className="text-sm font-medium">
                Starting Price (ETH)
              </Label>

              <Input
                id="startingPrice"
                name="startingPrice"
                type="number"
                step="0.0001"
                placeholder="0.1"
                value={formData.startingPrice}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationMinutes" className="text-sm font-medium">
                Duration (Minutes)
              </Label>

              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min="1"
                placeholder="1"
                value={formData.durationMinutes}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 gap-2 bg-gradient-to-r from-secondary to-accent hover:opacity-90"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? "Creating..." : "Create Auction"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  resetForm();
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};