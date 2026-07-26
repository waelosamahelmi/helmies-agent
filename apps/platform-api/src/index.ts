// Helmies Studio — Platform API Server
// Commercial backend: identity bridge, wallet, pricing, jobs, admin

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@helmies/shared-config";
import { prisma } from "./lib/prisma";
import { identityRouter } from "./routes/identity";
import { walletRouter } from "./routes/wallet";
import { pricingRouter } from "./routes/pricing";
import { generationRouter } from "./routes/generation";
import { assetRouter } from "./routes/assets";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";

const app = express();
const PORT = parseInt(process.env.PORT || "3004", 10);

// ── Global middleware ──
app.use(helmet());
app.use(cors({
  origin: env.NEXTAUTH_URL,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// Request ID
app.use((req, _res, next) => {
  (req as any).requestId = crypto.randomUUID();
  next();
});

// ── Public routes (no auth required) ──
app.use("/api/public", publicRouter);

// ── Authenticated routes ──
app.use("/api/identity", authMiddleware, identityRouter);
app.use("/api/wallet", authMiddleware, walletRouter);
app.use("/api/pricing", authMiddleware, pricingRouter);
app.use("/api/generate", authMiddleware, generationRouter);
app.use("/api/assets", authMiddleware, assetRouter);

// ── Admin routes ──
app.use("/api/admin", authMiddleware, adminRouter);

// ── Stripe webhooks (raw body) ──
app.use("/api/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  // Stripe webhook handling
  res.json({ received: true });
});

// ── Health check ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "platform-api", timestamp: new Date().toISOString() });
});

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
async function start() {
  try {
    await prisma.$connect();
    console.log("[platform-api] Connected to PostgreSQL");

    app.listen(PORT, () => {
      console.log(`[platform-api] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[platform-api] Failed to start:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[platform-api] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

start();

export default app;
