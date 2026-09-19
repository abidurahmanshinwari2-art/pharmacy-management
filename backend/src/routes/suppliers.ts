import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, requireRoles } from "../middleware/auth";

export const suppliersRouter = Router();
suppliersRouter.use(authRequired);

suppliersRouter.get("/", async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } },
  });
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

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
    },
  });
  res.status(201).json(supplier);
});

suppliersRouter.patch("/:id", requireRoles("ADMIN", "PHARMACIST", "STOREKEEPER"), async (req, res) => {
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(supplier);
});
