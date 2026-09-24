import { Router } from "express";
import { z } from "zod";
import { daysUntil } from "../lib/helpers";
import { loadDb, newId, nowIso, stockOf, withDb } from "../lib/storeDb";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const inventoryRouter = Router();
inventoryRouter.use(authRequired);

inventoryRouter.get("/", async (_req, res) => {
  const db = loadDb();
  const batches = db.batches
    .slice()
    .sort((a, b) => {
      const byDate = +new Date(a.expiryDate) - +new Date(b.expiryDate);
      if (byDate !== 0) return byDate;
      const ma = db.medicines.find((m) => m.id === a.medicineId);
      const mb = db.medicines.find((m) => m.id === b.medicineId);
      return String(ma?.brandName || "").localeCompare(String(mb?.brandName || ""));
    })
    .map((b) => {
      const medicine = db.medicines.find((m) => m.id === b.medicineId);
      const left = daysUntil(b.expiryDate);
      return {
        ...b,
        medicine: medicine
          ? { ...medicine, category: db.categories.find((c) => c.id === medicine.categoryId) || null }
          : null,
        daysLeft: left,
        status:
          b.quantity <= 0
            ? "OUT"
            : left < 0
              ? "EXPIRED"
              : left <= 30
                ? "NEAR_EXPIRY"
                : medicine && b.quantity <= medicine.reorderLevel
                  ? "LOW"
                  : "OK",
      };
    });
  res.json(batches);
});

inventoryRouter.get("/alerts", async (_req, res) => {
  const db = loadDb();
  const batches = db.batches.map((b) => ({
    ...b,
    medicine: db.medicines.find((m) => m.id === b.medicineId) || null,
  }));
  res.json({
    expired: batches.filter((b) => daysUntil(b.expiryDate) < 0 && b.quantity > 0),
    nearExpiry: batches.filter((b) => daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 30 && b.quantity > 0),
    lowStock: db.medicines
      .map((m) => ({
        ...m,
        stock: stockOf(db, m.id),
        batches: db.batches.filter((b) => b.medicineId === m.id),
        category: db.categories.find((c) => c.id === m.categoryId) || null,
      }))
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

  try {
    const result = withDb((db) => {
      const batch = db.batches.find((b) => b.id === parsed.data.batchId);
      if (!batch) throw new Error("Batch not found.");
      const nextQty = Number(batch.quantity) + parsed.data.quantity;
      if (nextQty < 0) throw new Error("Adjustment would make stock negative.");
      batch.quantity = nextQty;
      db.stockAdjustments.push({
        id: newId(),
        batchId: batch.id,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
        note: parsed.data.note || "",
        createdById: req.user!.id,
        createdAt: nowIso(),
      });
      return batch;
    });
    writeAudit(req.user?.id, "ADJUST", "Batch", parsed.data.batchId, parsed.data.reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not adjust stock." });
  }
});
