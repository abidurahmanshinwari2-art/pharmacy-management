import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, requireRoles } from "../middleware/auth";

export const expensesRouter = Router();
expensesRouter.use(authRequired);

expensesRouter.get("/", async (_req, res) => {
  res.json(await prisma.expense.findMany({ orderBy: { date: "desc" } }));
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
  const expense = await prisma.expense.create({
    data: {
      title: parsed.data.title,
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      notes: parsed.data.notes,
    },
  });
  res.status(201).json(expense);
});
