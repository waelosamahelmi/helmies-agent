// Helmies Studio — Worker Wallet Service (minimal copy for settlement)

import { prisma } from "../lib/prisma";

export async function settleReservation(reservationId: string, actualCredits: number) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "active") return;

    const wallet = await tx.creditWallet.findUnique({ where: { userId: reservation.userId } });
    if (!wallet) return;

    const unused = reservation.amount - actualCredits;
    if (unused < 0) return;

    await tx.creditWallet.update({
      where: { userId: reservation.userId },
      data: {
        reserved: wallet.reserved - reservation.amount,
        available: wallet.available + unused,
        lifetimeDebited: wallet.lifetimeDebited + BigInt(actualCredits),
      },
    });

    await tx.creditReservation.update({
      where: { id: reservationId },
      data: { status: "settled", settledAt: new Date() },
    });

    if (actualCredits > 0) {
      await tx.creditLedger.create({
        data: {
          userId: reservation.userId,
          delta: -actualCredits,
          balanceAfter: wallet.available + unused,
          reservedAfter: wallet.reserved - reservation.amount,
          type: "generation",
          description: `Generation completed: ${actualCredits} credits`,
          referenceType: "job",
          referenceId: reservation.jobId || undefined,
        },
      });
    }

    if (unused > 0) {
      await tx.creditLedger.create({
        data: {
          userId: reservation.userId,
          delta: unused,
          balanceAfter: wallet.available + unused,
          reservedAfter: wallet.reserved - reservation.amount,
          type: "reservation_release",
          description: `Released ${unused} unused credits`,
          referenceType: "reservation",
          referenceId: reservation.id,
        },
      });
    }
  });
}

export async function releaseReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "active") return;

    const wallet = await tx.creditWallet.findUnique({ where: { userId: reservation.userId } });
    if (!wallet) return;

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
        description: `Released ${reservation.amount} credits (failed/cancelled)`,
        referenceType: "reservation",
        referenceId: reservation.id,
      },
    });
  });
}
