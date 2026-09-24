import { Router } from "express";
import { z } from "zod";
import { nextNumber } from "../lib/helpers";
import { loadDb, newId, nowIso, withDb, withPurchase } from "../lib/storeDb";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const purchasesRouter = Router();
purchasesRouter.use(authRequired);

purchasesRouter.get("/", async (_req, res) => {
  const db = loadDb();
  const purchases = db.purchases
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((p) => withPurchase(db, p));
  res.json(purchases);
});

purchasesRouter.post("/", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z
    .object({
      supplierId: z.string(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            medicineId: z.string(),
            batchNo: z.string().min(1),
            expiryDate: z.string(),
            quantity: z.number().int().positive(),
            costPrice: z.number().positive(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Add a supplier and at least one purchase line." });
  }

  try {
    const purchase = withDb((db) => {
      const invoiceNo = nextNumber("PO");
      const createdAt = nowIso();
      const purchaseId = newId();
      const lines = parsed.data.items.map((item) => ({
        id: newId(),
        purchaseId,
        medicineId: item.medicineId,
        batchNo: item.batchNo,
        expiryDate: new Date(item.expiryDate).toISOString(),
        quantity: item.quantity,
        costPrice: item.costPrice,
        lineTotal: item.quantity * item.costPrice,
      }));
      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const created = {
        id: purchaseId,
        invoiceNo,
        date: createdAt,
        status: "RECEIVED",
        supplierId: parsed.data.supplierId,
        notes: parsed.data.notes || "",
        subtotal,
        tax: 0,
        total: subtotal,
        createdById: req.user!.id,
        createdAt,
      };
      db.purchases.push(created);
      db.purchaseItems.push(...lines);

      for (const item of lines) {
        const existing = db.batches.find((b) => b.medicineId === item.medicineId && b.batchNo === item.batchNo);
        if (existing) {
          existing.quantity = Number(existing.quantity) + item.quantity;
          existing.costPrice = item.costPrice;
          existing.expiryDate = item.expiryDate;
        } else {
          db.batches.push({
            id: newId(),
            medicineId: item.medicineId,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            costPrice: item.costPrice,
            location: "Main shelf",
            createdAt,
          });
        }
        const medicine = db.medicines.find((m) => m.id === item.medicineId);
        if (medicine) medicine.purchasePrice = item.costPrice;
      }

      return withPurchase(db, created);
    });

    writeAudit(req.user?.id, "CREATE", "Purchase", purchase.id, purchase.invoiceNo);
    res.status(201).json(purchase);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not receive purchase." });
  }
});
