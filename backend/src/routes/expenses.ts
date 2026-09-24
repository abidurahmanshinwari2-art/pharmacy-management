import { Router } from "express";
import { z } from "zod";
import { loadDb, newId, nowIso, withDb } from "../lib/storeDb";
import { authRequired, requireRoles } from "../middleware/auth";

export const expensesRouter = Router();
expensesRouter.use(authRequired);

expensesRouter.get("/", async (_req, res) => {
  const expenses = loadDb().expenses.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json(expenses);
});

expensesRouter.post("/", requireRoles("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const parsed = z
    .object({
      title: z.string().min(2),
      amount: z.number().positive(),
      category: z.string().min(1).default("General"),
      date: z.string().optional(),
      notes: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Write a title and amount." });
  const expense = withDb((db) => {
    const created = {
      id: newId(),
      title: parsed.data.title,
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date ? new Date(parsed.data.date).toISOString() : nowIso(),
      notes: parsed.data.notes || "",
      createdAt: nowIso(),
    };
    db.expenses.push(created);
    return created;
  });
  res.status(201).json(expense);
});
