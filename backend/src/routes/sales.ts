import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { nextNumber } from "../lib/helpers";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const salesRouter = Router();
salesRouter.use(authRequired);

salesRouter.get("/", async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 50),
  });
  res.json(sales);
});

salesRouter.get("/:id", async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { medicine: true, batch: true } },
      returns: true,
    },
  });
  if (!sale) return res.status(404).json({ message: "Sale not found." });
  res.json(sale);
});

salesRouter.post("/", requireRoles("ADMIN", "PHARMACIST", "CASHIER"), async (req, res) => {
  const parsed = z
    .object({
      customerId: z.string().optional().nullable(),
      type: z.enum(["WALK_IN", "PRESCRIPTION"]).default("WALK_IN"),
      doctorName: z.string().optional(),
      rxNumber: z.string().optional(),
      discount: z.number().min(0).default(0),
      paymentMethod: z.enum(["CASH", "CARD", "WALLET", "CREDIT"]),
      paid: z.number().min(0),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            medicineId: z.string(),
            batchId: z.string().optional(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().positive(),
            discount: z.number().min(0).default(0),
          })
        )
        .min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Add at least one medicine to complete the sale." });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const settings = await tx.storeSetting.findFirst();
      const invoiceNo = await nextNumber("INV");
      const prepared = [];

      for (const item of parsed.data.items) {
        const medicine = await tx.medicine.findUnique({
          where: { id: item.medicineId },
          include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
        });
        if (!medicine) throw new Error("A medicine on this bill was not found.");

        let batch = item.batchId
          ? await tx.batch.findUnique({ where: { id: item.batchId } })
          : medicine.batches[0];

        if (!batch || batch.quantity < item.quantity) {
          throw new Error(`${medicine.brandName} does not have enough stock.`);
        }

        const taxRate = Number(medicine.taxPercent || settings?.taxPercent || 0);
        const taxable = item.quantity * item.unitPrice - item.discount;
        const tax = (taxable * taxRate) / 100;

        prepared.push({
          medicineId: medicine.id,
          batchId: batch.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          tax,
          lineTotal: taxable + tax,
          costPrice: Number(batch.costPrice),
        });
      }

      const subtotal = prepared.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tax = prepared.reduce((sum, item) => sum + item.tax, 0);
      const total = subtotal - parsed.data.discount + tax;

      if (parsed.data.paymentMethod !== "CREDIT" && parsed.data.paid < total) {
        throw new Error("Paid amount is less than the bill total.");
      }
      if (parsed.data.paymentMethod === "CREDIT" && !parsed.data.customerId) {
        throw new Error("Select a customer for a loan bill.");
      }

      const created = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: parsed.data.customerId || null,
          type: parsed.data.type,
          doctorName: parsed.data.doctorName,
          rxNumber: parsed.data.rxNumber,
          subtotal,
          discount: parsed.data.discount,
          tax,
          total,
          paid: parsed.data.paymentMethod === "CREDIT" ? parsed.data.paid : total,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes,
          createdById: req.user!.id,
          items: { create: prepared },
        },
        include: {
          customer: true,
          createdBy: { select: { name: true } },
          items: { include: { medicine: true, batch: true } },
        },
      });

      for (const item of prepared) {
        await tx.batch.update({
          where: { id: item.batchId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      if (parsed.data.customerId && parsed.data.paymentMethod === "CREDIT") {
        const customer = await tx.customer.findUnique({ where: { id: parsed.data.customerId } });
        if (!customer) throw new Error("Customer not found.");
        const due = total - parsed.data.paid;
        const limit = Number(customer.creditLimit || 0);
        const remaining = Number(customer.outstanding || 0);
        if (limit <= 0) throw new Error("This customer has no loan limit.");
        if (remaining + due > limit + 0.001) {
          throw new Error("This customer cannot take more loan. The loan limit is finished.");
        }
        await tx.customer.update({
          where: { id: parsed.data.customerId },
          data: { outstanding: { increment: due } },
        });
      }

      return created;
    });

    await writeAudit(req.user?.id, "CREATE", "Sale", sale.id, sale.invoiceNo);
    res.status(201).json(sale);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not complete sale." });
  }
});

salesRouter.patch("/:id", requireRoles("ADMIN", "PHARMACIST", "CASHIER"), async (req, res) => {
  const parsed = z
    .object({
      discount: z.number().min(0).optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            saleItemId: z.string().optional(),
            medicineId: z.string().optional(),
            batchId: z.string().optional(),
            quantity: z.number().int().min(0),
            unitPrice: z.number().positive(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Please edit the bill items." });

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { medicine: true, batch: true } } },
      });
      if (!existing) throw new Error("Sale not found.");
      if (existing.status === "RETURNED" || existing.status === "VOID") {
        throw new Error("This bill cannot be changed.");
      }

      const settings = await tx.storeSetting.findFirst();
      const discount = parsed.data.discount ?? Number(existing.discount);

      const keepIds = new Set(parsed.data.items.map((row) => row.saleItemId).filter(Boolean));
      for (const item of existing.items) {
        if (!keepIds.has(item.id)) {
          await tx.batch.update({ where: { id: item.batchId }, data: { quantity: { increment: item.quantity } } });
          await tx.saleItem.delete({ where: { id: item.id } });
        }
      }

      for (const row of parsed.data.items) {
        if (row.saleItemId) {
          const item = existing.items.find((i) => i.id === row.saleItemId);
          if (!item) throw new Error("A bill line was not found.");
          if (row.quantity <= 0) {
            await tx.batch.update({ where: { id: item.batchId }, data: { quantity: { increment: item.quantity } } });
            await tx.saleItem.delete({ where: { id: item.id } });
            continue;
          }
          const delta = row.quantity - item.quantity;
          if (delta > 0) {
            const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
            if (!batch || batch.quantity < delta) {
              throw new Error(`${item.medicine.brandName} does not have enough stock.`);
            }
            await tx.batch.update({ where: { id: item.batchId }, data: { quantity: { decrement: delta } } });
          } else if (delta < 0) {
            await tx.batch.update({ where: { id: item.batchId }, data: { quantity: { increment: -delta } } });
          }
          const taxRate = Number(item.medicine.taxPercent || settings?.taxPercent || 0);
          const taxable = row.quantity * row.unitPrice - Number(item.discount);
          const tax = (taxable * taxRate) / 100;
          await tx.saleItem.update({
            where: { id: item.id },
            data: { quantity: row.quantity, unitPrice: row.unitPrice, tax, lineTotal: taxable + tax },
          });
          continue;
        }

        if (!row.medicineId || row.quantity <= 0) continue;
        const medicine = await tx.medicine.findUnique({
          where: { id: row.medicineId },
          include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
        });
        if (!medicine) throw new Error("A medicine on this bill was not found.");
        const batch = row.batchId
          ? await tx.batch.findUnique({ where: { id: row.batchId } })
          : medicine.batches[0];
        if (!batch || batch.quantity < row.quantity) {
          throw new Error(`${medicine.brandName} does not have enough stock.`);
        }
        const taxRate = Number(medicine.taxPercent || settings?.taxPercent || 0);
        const taxable = row.quantity * row.unitPrice;
        const tax = (taxable * taxRate) / 100;
        await tx.saleItem.create({
          data: {
            saleId: existing.id,
            medicineId: medicine.id,
            batchId: batch.id,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            discount: 0,
            tax,
            lineTotal: taxable + tax,
            costPrice: Number(batch.costPrice),
          },
        });
        await tx.batch.update({ where: { id: batch.id }, data: { quantity: { decrement: row.quantity } } });
      }

      const items = await tx.saleItem.findMany({ where: { saleId: existing.id } });
      const subtotal = items.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);
      const tax = items.reduce((sum, item) => sum + Number(item.tax), 0);
      const total = subtotal - discount + tax;
      const paid = existing.paymentMethod === "CREDIT" ? Math.min(Number(existing.paid), total) : total;

      if (existing.customerId && existing.paymentMethod === "CREDIT") {
        const oldDue = Math.max(Number(existing.total) - Number(existing.paid), 0);
        const newDue = Math.max(total - paid, 0);
        const delta = newDue - oldDue;
        if (delta !== 0) {
          const customer = await tx.customer.findUnique({ where: { id: existing.customerId } });
          if (!customer) throw new Error("Customer not found.");
          const remaining = Number(customer.outstanding || 0) + delta;
          if (delta > 0 && remaining > Number(customer.creditLimit || 0) + 0.001) {
            throw new Error("This customer cannot take more loan. The loan limit is finished.");
          }
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { outstanding: { increment: delta } },
          });
        }
      }

      return tx.sale.update({
        where: { id: existing.id },
        data: { subtotal, discount, tax, total, paid },
        include: {
          customer: true,
          createdBy: { select: { name: true } },
          items: { include: { medicine: true, batch: true } },
        },
      });
    });

    await writeAudit(req.user?.id, "UPDATE", "Sale", sale.id, sale.invoiceNo);
    res.json(sale);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not edit bill." });
  }
});

salesRouter.post("/:id/return", requireRoles("ADMIN", "PHARMACIST", "CASHIER"), async (req, res) => {
  const parsed = z
    .object({
      reason: z.string().min(3),
      items: z.array(z.object({ saleItemId: z.string(), quantity: z.number().int().positive() })).min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Select items and a return reason." });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!sale) throw new Error("Sale not found.");
      if (sale.status === "VOID") throw new Error("This bill is already void.");

      let returnTotal = 0;
      for (const item of parsed.data.items) {
        const saleItem = sale.items.find((s) => s.id === item.saleItemId);
        if (!saleItem) throw new Error("A return line does not belong to this bill.");
        if (item.quantity > saleItem.quantity) throw new Error("Return quantity is higher than sold quantity.");

        const unitNet = Number(saleItem.lineTotal) / saleItem.quantity;
        returnTotal += unitNet * item.quantity;

        await tx.batch.update({
          where: { id: saleItem.batchId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      const created = await tx.saleReturn.create({
        data: {
          saleId: sale.id,
          reason: parsed.data.reason,
          total: returnTotal,
          createdById: req.user!.id,
          items: { create: parsed.data.items },
        },
      });

      const returnedAll = parsed.data.items.reduce((sum, i) => sum + i.quantity, 0) ===
        sale.items.reduce((sum, i) => sum + i.quantity, 0);

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: returnedAll ? "RETURNED" : "PARTIAL_RETURN" },
      });

      if (sale.customerId && sale.paymentMethod === "CREDIT") {
        const saleDue = Math.max(Number(sale.total) - Number(sale.paid), 0);
        const reduceDue = Math.min(saleDue, returnTotal);
        if (reduceDue > 0) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { outstanding: { decrement: reduceDue } },
          });
        }
      }

      return created;
    });

    await writeAudit(req.user?.id, "RETURN", "Sale", req.params.id, parsed.data.reason);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not process return." });
  }
});
