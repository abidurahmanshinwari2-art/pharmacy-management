import { Router } from "express";
import { z } from "zod";
import { nextNumber } from "../lib/helpers";
import { loadDb, newId, nowIso, withDb, withSale } from "../lib/storeDb";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const salesRouter = Router();
salesRouter.use(authRequired);

salesRouter.get("/", async (req, res) => {
  const db = loadDb();
  const limit = Number(req.query.limit || 50);
  const sales = db.sales
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((sale) => withSale(db, sale));
  res.json(sales);
});

salesRouter.get("/:id", async (req, res) => {
  const db = loadDb();
  const sale = db.sales.find((s) => s.id === req.params.id);
  if (!sale) return res.status(404).json({ message: "Sale not found." });
  res.json(withSale(db, sale, true));
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
    const sale = withDb((db) => {
      const settings = db.storeSettings[0];
      const invoiceNo = nextNumber("INV");
      const prepared = [];

      for (const item of parsed.data.items) {
        const medicine = db.medicines.find((m) => m.id === item.medicineId);
        if (!medicine) throw new Error("A medicine on this bill was not found.");
        const openBatches = db.batches
          .filter((b) => b.medicineId === medicine.id && Number(b.quantity) > 0)
          .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
        const batch = item.batchId ? db.batches.find((b) => b.id === item.batchId) : openBatches[0];
        if (!batch || Number(batch.quantity) < item.quantity) {
          throw new Error(`${medicine.brandName} does not have enough stock.`);
        }
        const taxRate = Number(medicine.taxPercent || settings?.taxPercent || 0);
        const taxable = item.quantity * item.unitPrice - item.discount;
        const tax = (taxable * taxRate) / 100;
        prepared.push({
          id: newId(),
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

      const createdAt = nowIso();
      const created = {
        id: newId(),
        invoiceNo,
        date: createdAt,
        customerId: parsed.data.customerId || null,
        type: parsed.data.type,
        doctorName: parsed.data.doctorName || "",
        rxNumber: parsed.data.rxNumber || "",
        subtotal,
        discount: parsed.data.discount,
        tax,
        total,
        paid: parsed.data.paymentMethod === "CREDIT" ? parsed.data.paid : total,
        paymentMethod: parsed.data.paymentMethod,
        status: "COMPLETED",
        notes: parsed.data.notes || "",
        createdById: req.user!.id,
        createdAt,
      };

      if (parsed.data.customerId && parsed.data.paymentMethod === "CREDIT") {
        const customer = db.customers.find((c) => c.id === parsed.data.customerId);
        if (!customer) throw new Error("Customer not found.");
        const due = total - parsed.data.paid;
        const limit = Number(customer.creditLimit || 0);
        const remaining = Number(customer.outstanding || 0);
        if (limit <= 0) throw new Error("This customer has no loan limit.");
        if (remaining + due > limit + 0.001) {
          throw new Error("This customer cannot take more loan. The loan limit is finished.");
        }
        customer.outstanding = remaining + due;
      }

      for (const item of prepared) {
        const batch = db.batches.find((b) => b.id === item.batchId);
        if (batch) batch.quantity = Number(batch.quantity) - item.quantity;
        db.saleItems.push({ ...item, saleId: created.id });
      }
      db.sales.push(created);
      return withSale(db, created, true);
    });

    writeAudit(req.user?.id, "CREATE", "Sale", sale.id, sale.invoiceNo);
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
    const sale = withDb((db) => {
      const existing = db.sales.find((s) => s.id === req.params.id);
      if (!existing) throw new Error("Sale not found.");
      if (existing.status === "RETURNED" || existing.status === "VOID") {
        throw new Error("This bill cannot be changed.");
      }

      const settings = db.storeSettings[0];
      const discount = parsed.data.discount ?? Number(existing.discount);
      const items = db.saleItems.filter((i) => i.saleId === existing.id);
      const keepIds = new Set(parsed.data.items.map((row) => row.saleItemId).filter(Boolean));

      for (const item of items) {
        if (!keepIds.has(item.id)) {
          const batch = db.batches.find((b) => b.id === item.batchId);
          if (batch) batch.quantity = Number(batch.quantity) + item.quantity;
          db.saleItems = db.saleItems.filter((i) => i.id !== item.id);
        }
      }

      for (const row of parsed.data.items) {
        if (row.saleItemId) {
          const item = db.saleItems.find((i) => i.id === row.saleItemId);
          if (!item) throw new Error("A bill line was not found.");
          const medicine = db.medicines.find((m) => m.id === item.medicineId);
          if (row.quantity <= 0) {
            const batch = db.batches.find((b) => b.id === item.batchId);
            if (batch) batch.quantity = Number(batch.quantity) + item.quantity;
            db.saleItems = db.saleItems.filter((i) => i.id !== item.id);
            continue;
          }
          const delta = row.quantity - item.quantity;
          const batch = db.batches.find((b) => b.id === item.batchId);
          if (delta > 0) {
            if (!batch || Number(batch.quantity) < delta) {
              throw new Error(`${medicine?.brandName || "Medicine"} does not have enough stock.`);
            }
            batch.quantity = Number(batch.quantity) - delta;
          } else if (delta < 0 && batch) {
            batch.quantity = Number(batch.quantity) - delta;
          }
          const taxRate = Number(medicine?.taxPercent || settings?.taxPercent || 0);
          const taxable = row.quantity * row.unitPrice - Number(item.discount || 0);
          const tax = (taxable * taxRate) / 100;
          item.quantity = row.quantity;
          item.unitPrice = row.unitPrice;
          item.tax = tax;
          item.lineTotal = taxable + tax;
          continue;
        }

        if (!row.medicineId || row.quantity <= 0) continue;
        const medicine = db.medicines.find((m) => m.id === row.medicineId);
        if (!medicine) throw new Error("A medicine on this bill was not found.");
        const openBatches = db.batches
          .filter((b) => b.medicineId === medicine.id && Number(b.quantity) > 0)
          .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
        const batch = row.batchId ? db.batches.find((b) => b.id === row.batchId) : openBatches[0];
        if (!batch || Number(batch.quantity) < row.quantity) {
          throw new Error(`${medicine.brandName} does not have enough stock.`);
        }
        const taxRate = Number(medicine.taxPercent || settings?.taxPercent || 0);
        const taxable = row.quantity * row.unitPrice;
        const tax = (taxable * taxRate) / 100;
        db.saleItems.push({
          id: newId(),
          saleId: existing.id,
          medicineId: medicine.id,
          batchId: batch.id,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          discount: 0,
          tax,
          lineTotal: taxable + tax,
          costPrice: Number(batch.costPrice),
        });
        batch.quantity = Number(batch.quantity) - row.quantity;
      }

      const nextItems = db.saleItems.filter((i) => i.saleId === existing.id);
      const subtotal = nextItems.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);
      const tax = nextItems.reduce((sum, item) => sum + Number(item.tax), 0);
      const total = subtotal - discount + tax;
      const paid = existing.paymentMethod === "CREDIT" ? Math.min(Number(existing.paid), total) : total;

      if (existing.customerId && existing.paymentMethod === "CREDIT") {
        const oldDue = Math.max(Number(existing.total) - Number(existing.paid), 0);
        const newDue = Math.max(total - paid, 0);
        const delta = newDue - oldDue;
        if (delta !== 0) {
          const customer = db.customers.find((c) => c.id === existing.customerId);
          if (!customer) throw new Error("Customer not found.");
          const remaining = Number(customer.outstanding || 0) + delta;
          if (delta > 0 && remaining > Number(customer.creditLimit || 0) + 0.001) {
            throw new Error("This customer cannot take more loan. The loan limit is finished.");
          }
          customer.outstanding = remaining;
        }
      }

      existing.subtotal = subtotal;
      existing.discount = discount;
      existing.tax = tax;
      existing.total = total;
      existing.paid = paid;
      if (parsed.data.notes !== undefined) existing.notes = parsed.data.notes;
      return withSale(db, existing, true);
    });

    writeAudit(req.user?.id, "UPDATE", "Sale", sale.id, sale.invoiceNo);
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
    const result = withDb((db) => {
      const sale = db.sales.find((s) => s.id === req.params.id);
      if (!sale) throw new Error("Sale not found.");
      if (sale.status === "VOID") throw new Error("This bill is already void.");
      const saleItems = db.saleItems.filter((i) => i.saleId === sale.id);

      let returnTotal = 0;
      for (const item of parsed.data.items) {
        const saleItem = saleItems.find((s) => s.id === item.saleItemId);
        if (!saleItem) throw new Error("A return line does not belong to this bill.");
        if (item.quantity > saleItem.quantity) throw new Error("Return quantity is higher than sold quantity.");
        const unitNet = Number(saleItem.lineTotal) / saleItem.quantity;
        returnTotal += unitNet * item.quantity;
        const batch = db.batches.find((b) => b.id === saleItem.batchId);
        if (batch) batch.quantity = Number(batch.quantity) + item.quantity;
      }

      const created = {
        id: newId(),
        saleId: sale.id,
        reason: parsed.data.reason,
        total: returnTotal,
        createdById: req.user!.id,
        createdAt: nowIso(),
      };
      db.saleReturns.push(created);
      for (const item of parsed.data.items) {
        db.saleReturnItems.push({
          id: newId(),
          returnId: created.id,
          saleItemId: item.saleItemId,
          quantity: item.quantity,
        });
      }

      const returnedAll =
        parsed.data.items.reduce((sum, i) => sum + i.quantity, 0) ===
        saleItems.reduce((sum, i) => sum + i.quantity, 0);
      sale.status = returnedAll ? "RETURNED" : "PARTIAL_RETURN";

      if (sale.customerId && sale.paymentMethod === "CREDIT") {
        const saleDue = Math.max(Number(sale.total) - Number(sale.paid), 0);
        const reduceDue = Math.min(saleDue, returnTotal);
        if (reduceDue > 0) {
          const customer = db.customers.find((c) => c.id === sale.customerId);
          if (customer) customer.outstanding = Number(customer.outstanding || 0) - reduceDue;
        }
      }

      return created;
    });

    writeAudit(req.user?.id, "RETURN", "Sale", String(req.params.id), parsed.data.reason);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not process return." });
  }
});
