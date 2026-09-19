import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, requireRoles } from "../middleware/auth";

export const catalogRouter = Router();
catalogRouter.use(authRequired);

catalogRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { medicines: true } } },
  });
  res.json(categories);
});

catalogRouter.post("/categories", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Category name is required." });
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json(category);
});

catalogRouter.get("/medicines", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const lite = String(req.query.lite || "") === "1";
  const include = {
    category: true,
    batches: lite
      ? { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" as const }, take: 4 }
      : { orderBy: { expiryDate: "asc" as const } },
  };

  const exact = q
    ? await prisma.medicine.findFirst({
        where: {
          OR: [{ barcode: q }, { sku: { equals: q, mode: "insensitive" } }],
        },
        include,
      })
    : null;

  const medicines = await prisma.medicine.findMany({
    where: q
      ? {
          OR: [
            { brandName: { contains: q, mode: "insensitive" } },
            { genericName: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include,
    orderBy: { brandName: "asc" },
    take: lite ? 24 : 80,
  });

  const list = exact ? [exact, ...medicines.filter((m) => m.id !== exact.id)] : medicines;

  res.json(
    list.map((m) => ({
      ...m,
      stock: m.batches.reduce((sum, b) => sum + b.quantity, 0),
    }))
  );
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

  const medicine = await prisma.medicine.create({
    data: {
      ...parsed.data,
      barcode: parsed.data.barcode || null,
    },
    include: { category: true, batches: true },
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

  const medicine = await prisma.medicine.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { category: true, batches: true },
  });
  res.json({
    ...medicine,
    stock: medicine.batches.reduce((sum, b) => sum + b.quantity, 0),
  });
});
