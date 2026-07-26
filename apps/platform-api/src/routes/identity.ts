// Helmies Studio — Identity Routes

import { Router } from "express";
import { resolveIdentity, linkIdentities } from "../services/identity";

export const identityRouter = Router();

/**
 * GET /api/identity/me
 * Returns the current user's identity context (platform + agent).
 */
identityRouter.get("/me", async (req, res) => {
  try {
    const ctx = req.userContext!;
    res.json({
      platformUserId: ctx.platformUserId,
      agentUserId: ctx.agentUserId,
      email: ctx.email,
      role: ctx.role,
      plan: ctx.plan,
      wallet: ctx.wallet,
      isLinkedToAgent: ctx.isLinkedToAgent,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve identity" });
  }
});

/**
 * POST /api/identity/link
 * Links a platform user to an agent user.
 * Body: { agentUserId: string }
 */
identityRouter.post("/link", async (req, res) => {
  try {
    const { agentUserId } = req.body;
    if (!agentUserId || typeof agentUserId !== "string") {
      return res.status(400).json({ error: "agentUserId is required" });
    }

    const result = await linkIdentities(req.userContext!.platformUserId, agentUserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to link identities" });
  }
});

/**
 * GET /api/identity/agent-context
 * Returns the minimal context needed for agent tool execution.
 * Used by the Agent API to resolve platform user for commercial operations.
 */
identityRouter.get("/agent-context", async (req, res) => {
  try {
    const ctx = req.userContext!;
    res.json({
      platformUserId: ctx.platformUserId,
      plan: ctx.plan,
      walletAvailable: ctx.wallet.available,
      walletReserved: ctx.wallet.reserved,
      features: {
        director: ctx.plan !== "free",
        brandKits: ctx.plan !== "free",
        apiAccess: ctx.plan === "pro",
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent context" });
  }
});
