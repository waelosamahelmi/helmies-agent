// Helmies Studio — Auth Middleware
// Validates platform user session and attaches user context

import { Request, Response, NextFunction } from "express";
import { getPlatformUserContext } from "../services/identity";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userContext?: Awaited<ReturnType<typeof getPlatformUserContext>>;
      requestId: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Try session cookie first (from NextAuth)
    const sessionToken =
      req.cookies?.["next-auth.session-token"] ||
      req.cookies?.["__Secure-next-auth.session-token"];

    // Try Bearer token (API key)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    let userId: string | null = null;

    if (sessionToken) {
      // Look up session from shared Postgres
      const { prisma } = await import("../lib/prisma");
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        select: { userId: true, expires: true },
      });

      if (session && session.expires > new Date()) {
        userId = session.userId;
      }
    } else if (bearerToken) {
      // Validate API key
      const { prisma } = await import("../lib/prisma");
      const crypto = await import("crypto");
      const keyHash = crypto.createHash("sha256").update(bearerToken).digest("hex");

      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: { userId: true, isActive: true },
      });

      if (apiKey?.isActive) {
        userId = apiKey.userId;
        // Update last used
        await prisma.apiKey.update({
          where: { keyHash },
          data: { lastUsedAt: new Date() },
        });
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Attach full user context
    req.userContext = await getPlatformUserContext(userId);
    next();
  } catch (error) {
    console.error("[auth-middleware] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Admin-only middleware. Must be used after authMiddleware.
 */
export function requireAdmin(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userContext) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const allowedRoles = roles.length > 0 ? roles : ["admin", "super_admin"];
    if (!allowedRoles.includes(req.userContext.role)) {
      return res.status(403).json({ error: "Forbidden: admin access required" });
    }

    next();
  };
}
