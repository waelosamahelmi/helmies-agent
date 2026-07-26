// Helmies Studio — Identity Bridge Service
// Maps platformUserId (Postgres) ↔ agentUserId (Mongo)
// Phase 2: One identity across landing, studio, and agent

import { prisma } from "../lib/prisma";

export interface IdentityLinkResult {
  platformUserId: string;
  agentUserId: string;
}

/**
 * Link a platform user (Postgres/NextAuth) to an agent user (Mongo/LibreChat).
 * Called when a user logs in and both identities exist.
 */
export async function linkIdentities(
  platformUserId: string,
  agentUserId: string,
): Promise<IdentityLinkResult> {
  const existing = await prisma.identityLink.findFirst({
    where: {
      OR: [
        { platformUserId },
        { agentUserId },
      ],
    },
  });

  if (existing) {
    // Update if needed
    if (existing.platformUserId !== platformUserId || existing.agentUserId !== agentUserId) {
      return prisma.identityLink.update({
        where: { id: existing.id },
        data: { platformUserId, agentUserId },
      });
    }
    return { platformUserId: existing.platformUserId, agentUserId: existing.agentUserId };
  }

  // Create new link
  const link = await prisma.identityLink.create({
    data: { platformUserId, agentUserId },
  });

  return { platformUserId: link.platformUserId, agentUserId: link.agentUserId };
}

/**
 * Get agent user ID from platform user ID.
 */
export async function getAgentUserId(platformUserId: string): Promise<string | null> {
  const link = await prisma.identityLink.findUnique({
    where: { platformUserId },
  });
  return link?.agentUserId ?? null;
}

/**
 * Get platform user ID from agent user ID.
 */
export async function getPlatformUserId(agentUserId: string): Promise<string | null> {
  const link = await prisma.identityLink.findUnique({
    where: { agentUserId },
  });
  return link?.platformUserId ?? null;
}

/**
 * Resolve the full linked identity for a platform user.
 * Returns both IDs if linked, or just the platform ID if not yet linked.
 */
export async function resolveIdentity(platformUserId: string): Promise<IdentityLinkResult> {
  const agentUserId = await getAgentUserId(platformUserId);
  return { platformUserId, agentUserId: agentUserId ?? "" };
}

/**
 * Get platform user with plan, wallet, and subscription info.
 */
export async function getPlatformUserContext(platformUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: platformUserId },
    include: {
      wallet: true,
      subscriptions: {
        where: { status: "active" },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const identity = await resolveIdentity(platformUserId);

  return {
    platformUserId: user.id,
    agentUserId: identity.agentUserId,
    email: user.email,
    role: user.role,
    plan: user.subscriptions[0]?.plan ?? "free",
    subscriptionStatus: user.subscriptions[0]?.status ?? "active",
    wallet: user.wallet
      ? {
          available: user.wallet.available,
          reserved: user.wallet.reserved,
        }
      : { available: user.credits, reserved: 0 },
    isLinkedToAgent: !!identity.agentUserId,
  };
}
