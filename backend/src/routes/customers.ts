import { Router } from "express";
import { z } from "zod";
import { loadDb, newId, nowIso, withCustomer, withDb } from "../lib/storeDb";
import { authRequired } from "../middleware/auth";

export const customersRouter = Router();
customersRouter.use(authRequired);

customersRouter.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const customers = withDb((db) => {
    let list = db.customers.slice();
    if (q) {
      list = list.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list.map((c) => withCustomer(db, c));
  });
  res.json(customers);
});

customersRouter.post("/", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2),
      phone: z.string().optional(),
      address: z.string().optional(),
      creditLimit: z.number().min(0).default(0),
      notes: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Customer name is required." });

  const customer = withDb((db) => {
    const created = {
      id: newId(),
      name: parsed.data.name,
      phone: parsed.data.phone || "",
      address: parsed.data.address || "",
      creditLimit: parsed.data.creditLimit,
      outstanding: 0,
      notes: parsed.data.notes || "",
      createdAt: nowIso(),
    };
    db.customers.push(created);
    return withCustomer(db, created);
  });
  res.status(201).json(customer);
});

customersRouter.patch("/:id", async (req, res) => {
  try {
    const customer = withDb((db) => {
      const existing = db.customers.find((c) => c.id === req.params.id);
      if (!existing) throw new Error("Customer not found.");
      Object.assign(existing, req.body);
      return withCustomer(db, existing);
    });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not save customer." });
  }
});

customersRouter.post("/:id/pay", async (req, res) => {
  const parsed = z.object({ amount: z.coerce.number().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Write the paid amount." });

  try {
    const customer = withDb((db) => {
      const existing = db.customers.find((c) => c.id === req.params.id);
      if (!existing) throw new Error("Customer not found.");
      const dueNow = Number(existing.outstanding || 0);
      if (dueNow <= 0) throw new Error("This customer has no remaining amount.");
      const applied = Math.min(parsed.data.amount, dueNow);
      let left = applied;
      const loans = db.sales
        .filter((sale) => sale.customerId === existing.id && sale.paymentMethod === "CREDIT" && sale.status !== "VOID")
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      for (const sale of loans) {
        if (left <= 0) break;
        const due = Number(sale.total) - Number(sale.paid);
        if (due <= 0) continue;
        const part = Math.min(due, left);
        sale.paid = Number(sale.paid) + part;
        left -= part;
      }
      existing.outstanding = Number(existing.outstanding || 0) - applied;
      return withCustomer(db, existing);
    });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not save payment." });
  }
});
