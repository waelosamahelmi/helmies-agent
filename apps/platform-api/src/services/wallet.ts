// Helmies Studio — Wallet V2 Service
// Phase 3: Credit wallet with available/reserved accounting, ledger, and reservations.
//
// Accounting model:
//   available = freely spendable credits
//   reserved  = credits held for in-progress jobs
//
// Reserve:  available -= N, reserved += N
// Settle:   reserved -= N, actual debit recorded
// Release:  reserved -= N, available += N (unused portion)
//
// Wallet cannot go negative. All operations are atomic DB transactions.

import { prisma } from "../lib/prisma";
import { CONSTANTS } from "@helmies/shared-config";
import type { LedgerType } from "@helmies/contracts";

// ============================================================
// Wallet initialization
// ============================================================

export async function ensureWallet(userId: string) {
  const existing = await prisma.creditWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  // Get current credits from User table for migration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!user) throw new Error("User not found");

  return prisma.creditWallet.create({
    data: {
      userId,
      available: user.credits,
      reserved: 0,
      lifetimeCredited: BigInt(user.credits),
      lifetimeDebited: BigInt(0),
    },
  });
}

// ============================================================
// Read wallet
// ============================================================

export async function getWallet(userId: string) {
  return ensureWallet(userId);
}

export async function getAvailableCredits(userId: string): Promise<number> {
  const wallet = await ensureWallet(userId);
  return wallet.available;
}

// ============================================================
// Reserve credits for a job
// ============================================================

export async function reserveCredits(
  userId: string,
  amount: number,
  jobId: string,
): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: "Reservation amount must be positive" };
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    if (wallet.available < amount) {
      return {
        success: false,
        error: `Insufficient available credits. Available: ${wallet.available}, Required: ${amount}`,
      };
    }

    // Deduct from available, add to reserved
    await tx.creditWallet.update({
      where: { userId },
      data: {
        available: wallet.available - amount,
        reserved: wallet.reserved + amount,
      },
    });

    // Create reservation record
    const expiresAt = new Date(
      Date.now() + CONSTANTS.RESERVATION_EXPIRY_SEC * 1000,
    );

    const reservation = await tx.creditReservation.create({
      data: {
        userId,
        jobId,
        amount,
        status: "active",
        expiresAt,
      },
    });

    // Create ledger entry for reservation
    const balanceAfter = wallet.available - amount;
    await tx.creditLedger.create({
      data: {
        userId,
        delta: -amount,
        balanceAfter,
        reservedAfter: wallet.reserved + amount,
        type: "reservation",
        description: `Reserved ${amount} credits for job ${jobId}`,
        referenceType: "reservation",
        referenceId: reservation.id,
      },
    });

    return { success: true, reservationId: reservation.id };
  });
}

// ============================================================
// Settle a reservation (job completed)
// ============================================================

export async function settleReservation(
  reservationId: string,
  actualCredits: number,
): Promise<{ success: boolean; refundedCredits: number; error?: string }> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return { success: false, refundedCredits: 0, error: "Reservation not found" };
    }

    if (reservation.status !== "active") {
      return { success: false, refundedCredits: 0, error: `Reservation is ${reservation.status}` };
    }

    const wallet = await tx.creditWallet.findUnique({
      where: { userId: reservation.userId },
    });
    if (!wallet) {
      return { success: false, refundedCredits: 0, error: "Wallet not found" };
    }

    const reserved = reservation.amount;
    const unused = reserved - actualCredits;

    if (unused < 0) {
      return {
        success: false,
        refundedCredits: 0,
        error: `Actual credits (${actualCredits}) exceed reserved (${reserved})`,
      };
    }

    // Release reserved, return unused to available
    await tx.creditWallet.update({
      where: { userId: reservation.userId },
      data: {
        reserved: wallet.reserved - reserved,
        available: wallet.available + unused,
        lifetimeDebited: wallet.lifetimeDebited + BigInt(actualCredits),
      },
    });

    // Mark reservation settled
    await tx.creditReservation.update({
      where: { id: reservationId },
      data: { status: "settled", settledAt: new Date() },
    });

    // Ledger: generation debit
    if (actualCredits > 0) {
      await tx.creditLedger.create({
        data: {
          userId: reservation.userId,
          delta: -actualCredits,
          balanceAfter: wallet.available + unused,
          reservedAfter: wallet.reserved - reserved,
          type: "generation",
          description: `Generation completed: ${actualCredits} credits`,
          referenceType: "job",
          referenceId: reservation.jobId ?? undefined,
        },
      });
    }

    // Ledger: release unused
    if (unused > 0) {
      await tx.creditLedger.create({
        data: {
          userId: reservation.userId,
          delta: unused,
          balanceAfter: wallet.available + unused,
          reservedAfter: wallet.reserved - reserved,
          type: "reservation_release",
          description: `Released ${unused} unused credits from reservation`,
          referenceType: "reservation",
          referenceId: reservation.id,
        },
      });
    }

    return { success: true, refundedCredits: unused };
  });
}

// ============================================================
// Release a reservation (cancelled/failed job)
// ============================================================

export async function releaseReservation(
  reservationId: string,
): Promise<{ success: boolean; error?: string }> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return { success: false, error: "Reservation not found" };
    }

    if (reservation.status !== "active") {
      return { success: false, error: `Reservation is ${reservation.status}` };
    }

    const wallet = await tx.creditWallet.findUnique({
      where: { userId: reservation.userId },
    });
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    // Return reserved amount to available
    await tx.creditWallet.update({
      where: { userId: reservation.userId },
      data: {
        reserved: wallet.reserved - reservation.amount,
        available: wallet.available + reservation.amount,
      },
    });

    await tx.creditReservation.update({
      where: { id: reservationId },
      data: { status: "released" },
    });

    await tx.creditLedger.create({
      data: {
        userId: reservation.userId,
        delta: reservation.amount,
        balanceAfter: wallet.available + reservation.amount,
        reservedAfter: wallet.reserved - reservation.amount,
        type: "reservation_release",
        description: `Released ${reservation.amount} credits (job cancelled/failed)`,
        referenceType: "reservation",
        referenceId: reservation.id,
      },
    });

    return { success: true };
  });
}

// ============================================================
// Direct credit operations (admin, signup, topup, refund)
// ============================================================

export async function creditUser(
  userId: string,
  amount: number,
  type: LedgerType,
  description: string,
  referenceType?: string,
  referenceId?: string,
): Promise<{ success: boolean; balanceAfter: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, balanceAfter: 0, error: "Credit amount must be positive" };
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { success: false, balanceAfter: 0, error: "Wallet not found" };
    }

    const newAvailable = wallet.available + amount;

    await tx.creditWallet.update({
      where: { userId },
      data: {
        available: newAvailable,
        lifetimeCredited: wallet.lifetimeCredited + BigInt(amount),
      },
    });

    await tx.creditLedger.create({
      data: {
        userId,
        delta: amount,
        balanceAfter: newAvailable,
        reservedAfter: wallet.reserved,
        type,
        description,
        referenceType,
        referenceId,
      },
    });

    // Compatibility: also update User.credits during migration
    await tx.user.update({
      where: { id: userId },
      data: { credits: newAvailable + wallet.reserved },
    });

    return { success: true, balanceAfter: newAvailable };
  });
}

export async function debitUser(
  userId: string,
  amount: number,
  type: LedgerType,
  description: string,
): Promise<{ success: boolean; balanceAfter: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, balanceAfter: 0, error: "Debit amount must be positive" };
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { success: false, balanceAfter: 0, error: "Wallet not found" };
    }

    if (wallet.available < amount) {
      return {
        success: false,
        balanceAfter: wallet.available,
        error: `Insufficient credits. Available: ${wallet.available}, Required: ${amount}`,
      };
    }

    const newAvailable = wallet.available - amount;

    await tx.creditWallet.update({
      where: { userId },
      data: {
        available: newAvailable,
        lifetimeDebited: wallet.lifetimeDebited + BigInt(amount),
      },
    });

    await tx.creditLedger.create({
      data: {
        userId,
        delta: -amount,
        balanceAfter: newAvailable,
        reservedAfter: wallet.reserved,
        type,
        description,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { credits: newAvailable + wallet.reserved },
    });

    return { success: true, balanceAfter: newAvailable };
  });
}

// ============================================================
// Wallet migration from User.credits
// ============================================================

export async function migrateUserToWallet(userId: string) {
  const existing = await prisma.creditWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!user) throw new Error("User not found");

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.create({
      data: {
        userId,
        available: user.credits,
        reserved: 0,
        lifetimeCredited: BigInt(user.credits),
        lifetimeDebited: BigInt(0),
      },
    });

    await tx.creditLedger.create({
      data: {
        userId,
        delta: user.credits,
        balanceAfter: user.credits,
        reservedAfter: 0,
        type: "migration_opening_balance",
        description: "Wallet V2 migration — opening balance from User.credits",
      },
    });

    return wallet;
  });
}

// ============================================================
// Get ledger
// ============================================================

export async function getLedger(
  userId: string,
  limit = 50,
  offset = 0,
) {
  return prisma.creditLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
