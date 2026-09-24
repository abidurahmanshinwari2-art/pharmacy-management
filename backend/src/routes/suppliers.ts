import { Router } from "express";
import { z } from "zod";
import { loadDb, newId, nowIso, withDb } from "../lib/storeDb";
import { authRequired, requireRoles } from "../middleware/auth";

export const suppliersRouter = Router();
suppliersRouter.use(authRequired);

suppliersRouter.get("/", async (_req, res) => {
  const db = loadDb();
  const suppliers = db.suppliers
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((supplier) => ({
      ...supplier,
      _count: { purchases: db.purchases.filter((p) => p.supplierId === supplier.id).length },
    }));
  res.json(suppliers);
});

suppliersRouter.post("/", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().optional(),
      taxId: z.string().optional(),
      paymentTerms: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Supplier name is required." });

  const supplier = withDb((db) => {
    const created = {
      id: newId(),
      name: parsed.data.name,
      phone: parsed.data.phone || "",
      email: parsed.data.email || null,
      address: parsed.data.address || "",
      taxId: parsed.data.taxId || "",
      paymentTerms: parsed.data.paymentTerms || "Net 15",
      isActive: true,
      createdAt: nowIso(),
    };
    db.suppliers.push(created);
    return created;
  });
  res.status(201).json(supplier);
});

suppliersRouter.patch("/:id", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  try {
    const supplier = withDb((db) => {
      const existing = db.suppliers.find((s) => s.id === req.params.id);
      if (!existing) throw new Error("Supplier not found.");
      Object.assign(existing, req.body);
      return existing;
    });
    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not save supplier." });
  }
});
