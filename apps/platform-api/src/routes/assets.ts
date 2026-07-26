// Helmies Studio — Asset Routes

import { Router } from "express";
import { prisma } from "../lib/prisma";

export const assetRouter = Router();

/**
 * GET /api/assets
 * List user's assets.
 */
assetRouter.get("/", async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const assets = await prisma.asset.findMany({
      where: {
        userId: req.userContext!.platformUserId,
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    res.json({ assets });
  } catch (error) {
    res.status(500).json({ error: "Failed to get assets" });
  }
});

/**
 * GET /api/assets/:id
 * Get a single asset.
 */
assetRouter.get("/:id", async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
    });

    if (!asset || asset.userId !== req.userContext!.platformUserId) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json({ asset });
  } catch (error) {
    res.status(500).json({ error: "Failed to get asset" });
  }
});

/**
 * PATCH /api/assets/:id
 * Update asset (favorite, project, tags).
 */
assetRouter.patch("/:id", async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
    });

    if (!asset || asset.userId !== req.userContext!.platformUserId) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const updated = await prisma.asset.update({
      where: { id: req.params.id },
      data: {
        favorite: req.body.favorite,
        projectId: req.body.projectId,
        metadata: req.body.metadata,
      },
    });

    res.json({ asset: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update asset" });
  }
});

/**
 * DELETE /api/assets/:id
 * Soft-delete an asset.
 */
assetRouter.delete("/:id", async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
    });

    if (!asset || asset.userId !== req.userContext!.platformUserId) {
      return res.status(404).json({ error: "Asset not found" });
    }

    await prisma.asset.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete asset" });
  }
});
