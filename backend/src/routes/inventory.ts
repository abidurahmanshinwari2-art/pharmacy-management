import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { daysUntil } from "../lib/helpers";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const inventoryRouter = Router();
inventoryRouter.use(authRequired);

inventoryRouter.get("/", async (_req, res) => {
  const batches = await prisma.batch.findMany({
    include: { medicine: { include: { category: true } } },
    orderBy: [{ expiryDate: "asc" }, { medicine: { brandName: "asc" } }],
  });

  res.json(
    batches.map((b) => ({
      ...b,
      daysLeft: daysUntil(b.expiryDate),
      status:
        b.quantity <= 0
          ? "OUT"
          : daysUntil(b.expiryDate) < 0
            ? "EXPIRED"
            : daysUntil(b.expiryDate) <= 30
              ? "NEAR_EXPIRY"
              : b.quantity <= b.medicine.reorderLevel
                ? "LOW"
                : "OK",
    }))
  );
});

inventoryRouter.get("/alerts", async (_req, res) => {
  const batches = await prisma.batch.findMany({
    include: { medicine: true },
  });

  const lowStock = await prisma.medicine.findMany({
    include: { batches: true, category: true },
  });

  res.json({
    expired: batches.filter((b) => daysUntil(b.expiryDate) < 0 && b.quantity > 0),
    nearExpiry: batches.filter((b) => daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 30 && b.quantity > 0),
    lowStock: lowStock
      .map((m) => ({ ...m, stock: m.batches.reduce((s, b) => s + b.quantity, 0) }))
      .filter((m) => m.stock <= m.reorderLevel),
  });
});

inventoryRouter.post("/adjust", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z
    .object({
      batchId: z.string(),
      quantity: z.number().int(),
      reason: z.string().min(2),
      note: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Adjustment needs a batch, quantity and reason." });

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: parsed.data.batchId } });
    if (!batch) throw new Error("Batch not found.");
    const nextQty = batch.quantity + parsed.data.quantity;
    if (nextQty < 0) throw new Error("Adjustment would make stock negative.");

    const updated = await tx.batch.update({
      where: { id: batch.id },
      data: { quantity: nextQty },
    });

    await tx.stockAdjustment.create({
      data: {
        batchId: batch.id,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
        note: parsed.data.note,
        createdById: req.user!.id,
      },
    });

    return updated;
  });

  await writeAudit(req.user?.id, "ADJUST", "Batch", parsed.data.batchId, parsed.data.reason);
  res.json(result);
});
