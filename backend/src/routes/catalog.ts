import { Router } from "express";
import { z } from "zod";
import { loadDb, newId, nowIso, withDb, withMedicine } from "../lib/storeDb";
import { authRequired, requireRoles } from "../middleware/auth";

export const catalogRouter = Router();
catalogRouter.use(authRequired);

function matchText(value: unknown, q: string) {
  return String(value || "").toLowerCase().includes(q.toLowerCase());
}

catalogRouter.get("/categories", async (_req, res) => {
  const db = loadDb();
  const categories = db.categories
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((category) => ({
      ...category,
      _count: { medicines: db.medicines.filter((m) => m.categoryId === category.id).length },
    }));
  res.json(categories);
});

catalogRouter.post("/categories", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Category name is required." });
  const category = withDb((db) => {
    const created = { id: newId(), name: parsed.data.name };
    db.categories.push(created);
    return created;
  });
  res.status(201).json(category);
});

catalogRouter.get("/medicines", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const lite = String(req.query.lite || "") === "1";
  const db = loadDb();
  const exact = q
    ? db.medicines.find((m) => m.barcode === q || String(m.sku || "").toLowerCase() === q.toLowerCase())
    : null;
  let medicines = db.medicines.slice();
  if (q) {
    medicines = medicines.filter((m) =>
      matchText(m.brandName, q) || matchText(m.genericName, q) || matchText(m.sku, q) || matchText(m.barcode, q)
    );
  }
  medicines.sort((a, b) => String(a.brandName).localeCompare(String(b.brandName)));
  medicines = medicines.slice(0, lite ? 24 : 80);
  const list = exact ? [exact, ...medicines.filter((m) => m.id !== exact.id)] : medicines;
  res.json(list.map((m) => withMedicine(db, m, lite)));
});

catalogRouter.post("/medicines", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z
    .object({
      sku: z.string().min(2),
      barcode: z.string().optional().nullable(),
      brandName: z.string().min(2),
      genericName: z.string().min(2),
      strength: z.string().min(1),
      form: z.string().min(1),
      packSize: z.string().min(1),
      manufacturer: z.string().optional().nullable(),
      salePrice: z.number().positive(),
      purchasePrice: z.number().positive(),
      taxPercent: z.number().min(0).default(0),
      reorderLevel: z.number().int().min(0).default(10),
      isControlled: z.boolean().default(false),
      categoryId: z.string().min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Please complete the medicine form." });

  const medicine = withDb((db) => {
    const created = {
      id: newId(),
      ...parsed.data,
      barcode: parsed.data.barcode || null,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.medicines.push(created);
    return withMedicine(db, created);
  });
  res.status(201).json({ ...medicine, stock: 0 });
});

catalogRouter.patch("/medicines/:id", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z
    .object({
      sku: z.string().min(2).optional(),
      barcode: z.string().optional().nullable(),
      brandName: z.string().min(2).optional(),
      genericName: z.string().min(2).optional(),
      strength: z.string().min(1).optional(),
      form: z.string().min(1).optional(),
      packSize: z.string().min(1).optional(),
      manufacturer: z.string().optional().nullable(),
      salePrice: z.number().positive().optional(),
      purchasePrice: z.number().positive().optional(),
      taxPercent: z.number().min(0).optional(),
      reorderLevel: z.number().int().min(0).optional(),
      isControlled: z.boolean().optional(),
      isActive: z.boolean().optional(),
      categoryId: z.string().min(1).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Invalid medicine update." });

  try {
    const medicine = withDb((db) => {
      const existing = db.medicines.find((m) => m.id === req.params.id);
      if (!existing) throw new Error("Medicine not found.");
      Object.assign(existing, parsed.data);
      existing.updatedAt = nowIso();
      return withMedicine(db, existing);
    });
    res.json(medicine);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid medicine update." });
  }
});
