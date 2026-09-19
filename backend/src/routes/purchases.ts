import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { nextNumber } from "../lib/helpers";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const purchasesRouter = Router();
purchasesRouter.use(authRequired);

purchasesRouter.get("/", async (_req, res) => {
  const purchases = await prisma.purchase.findMany({
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { medicine: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
    const purchase = await prisma.$transaction(async (tx) => {
      const invoiceNo = await nextNumber("PO");
      const lines = parsed.data.items.map((item) => ({
        ...item,
        expiryDate: new Date(item.expiryDate),
        lineTotal: item.quantity * item.costPrice,
      }));
      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);

      const created = await tx.purchase.create({
        data: {
          invoiceNo,
          supplierId: parsed.data.supplierId,
          notes: parsed.data.notes,
          subtotal,
          tax: 0,
          total: subtotal,
          createdById: req.user!.id,
          items: {
            create: lines.map((item) => ({
              medicineId: item.medicineId,
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              quantity: item.quantity,
              costPrice: item.costPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { supplier: true, items: { include: { medicine: true } } },
      });

      for (const item of lines) {
        const existing = await tx.batch.findUnique({
          where: {
            medicineId_batchNo: { medicineId: item.medicineId, batchNo: item.batchNo },
          },
        });

        if (existing) {
          await tx.batch.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              costPrice: item.costPrice,
              expiryDate: item.expiryDate,
            },
          });
        } else {
          await tx.batch.create({
            data: {
              medicineId: item.medicineId,
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              quantity: item.quantity,
              costPrice: item.costPrice,
            },
          });
        }

        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { purchasePrice: item.costPrice },
        });
      }

      return created;
    });

    await writeAudit(req.user?.id, "CREATE", "Purchase", purchase.id, purchase.invoiceNo);
    res.status(201).json(purchase);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not receive purchase." });
  }
});
