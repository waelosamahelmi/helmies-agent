// Helmies Studio — Wallet Routes

import { Router } from "express";
import {
  getWallet,
  getLedger,
  reserveCredits,
  settleReservation,
  releaseReservation,
} from "../services/wallet";

export const walletRouter = Router();

/**
 * GET /api/wallet
 * Returns current wallet state.
 */
walletRouter.get("/", async (req, res) => {
  try {
    const wallet = await getWallet(req.userContext!.platformUserId);
    res.json({
      available: wallet.available,
      reserved: wallet.reserved,
      total: wallet.available + wallet.reserved,
      lifetimeCredited: wallet.lifetimeCredited.toString(),
      lifetimeDebited: wallet.lifetimeDebited.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get wallet" });
  }
});

/**
 * GET /api/wallet/ledger
 * Returns the credit transaction history.
 */
walletRouter.get("/ledger", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const ledger = await getLedger(req.userContext!.platformUserId, limit, offset);
    res.json({ entries: ledger });
  } catch (error) {
    res.status(500).json({ error: "Failed to get ledger" });
  }
});

/**
 * POST /api/wallet/reserve
 * Reserves credits for a job.
 * Body: { amount: number, jobId: string }
 */
walletRouter.post("/reserve", async (req, res) => {
  try {
    const { amount, jobId } = req.body;
    if (!amount || !jobId) {
      return res.status(400).json({ error: "amount and jobId are required" });
    }

    const result = await reserveCredits(
      req.userContext!.platformUserId,
      amount,
      jobId,
    );

    if (!result.success) {
      return res.status(402).json({ error: result.error });
    }

    res.json({ reservationId: result.reservationId });
  } catch (error) {
    res.status(500).json({ error: "Failed to reserve credits" });
  }
});

/**
 * POST /api/wallet/settle
 * Settles a reservation after job completion.
 * Body: { reservationId: string, actualCredits: number }
 */
walletRouter.post("/settle", async (req, res) => {
  try {
    const { reservationId, actualCredits } = req.body;
    if (!reservationId || actualCredits == null) {
      return res.status(400).json({ error: "reservationId and actualCredits are required" });
    }

    const result = await settleReservation(reservationId, actualCredits);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ refundedCredits: result.refundedCredits });
  } catch (error) {
    res.status(500).json({ error: "Failed to settle reservation" });
  }
});

/**
 * POST /api/wallet/release
 * Releases a reservation (cancelled/failed job).
 * Body: { reservationId: string }
 */
walletRouter.post("/release", async (req, res) => {
  try {
    const { reservationId } = req.body;
    if (!reservationId) {
      return res.status(400).json({ error: "reservationId is required" });
    }

    const result = await releaseReservation(reservationId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to release reservation" });
  }
});
