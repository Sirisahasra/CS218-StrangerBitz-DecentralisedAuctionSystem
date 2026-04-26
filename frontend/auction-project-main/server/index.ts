import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";
import { handleDemo } from "./routes/demo";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  app.post("/api/pinata/upload-file", upload.single("file"), async (req, res) => {
    try {
      if (!process.env.PINATA_JWT) {
        return res.status(500).json({
          error: "PINATA_JWT missing in .env file",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      const formData = new FormData();

      formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            ...formData.getHeaders(),
          },
          body: formData as any,
        }
      );

      const data: any = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error:
            data?.error?.details ||
            data?.error ||
            "Pinata image upload failed",
        });
      }

      return res.json({
        cid: data.IpfsHash,
      });
    } catch (error: any) {
      console.error("Pinata image upload error:", error);

      return res.status(500).json({
        error: error.message || "Image upload failed",
      });
    }
  });

  app.post("/api/pinata/upload-json", async (req, res) => {
    try {
      if (!process.env.PINATA_JWT) {
        return res.status(500).json({
          error: "PINATA_JWT missing in .env file",
        });
      }

      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pinataMetadata: {
              name: `auction-metadata-${Date.now()}`,
            },
            pinataContent: req.body,
          }),
        }
      );

      const data: any = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error:
            data?.error?.details ||
            data?.error ||
            "Pinata metadata upload failed",
        });
      }

      return res.json({
        cid: data.IpfsHash,
      });
    } catch (error: any) {
      console.error("Pinata metadata upload error:", error);

      return res.status(500).json({
        error: error.message || "Metadata upload failed",
      });
    }
  });

  return app;
}