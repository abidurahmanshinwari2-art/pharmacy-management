import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";

export const customersRouter = Router();
customersRouter.use(authRequired);

function mapCustomer(customer: {
  outstanding: unknown;
  sales?: { paid: unknown; total: unknown; status: string; paymentMethod?: string }[];
  [key: string]: unknown;
}) {
  const sales = customer.sales || [];
  const loanSales = sales.filter(
    (sale) => sale.paymentMethod === "CREDIT" && sale.status !== "VOID" && sale.status !== "RETURNED"
  );
  const paidLoan = loanSales.reduce((sum, sale) => sum + Number(sale.paid || 0), 0);
  const remaining = Number(customer.outstanding || 0);
  const { sales: _sales, ...rest } = customer;
  return {
    ...rest,
    outstanding: remaining,
    paidToUs: paidLoan,
    paidLoan,
    remaining,
    totalLoan: paidLoan + remaining,
  };
}

const customerInclude = {
  _count: { select: { sales: true } },
  sales: { select: { paid: true, total: true, status: true, paymentMethod: true } },
};

customersRouter.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: customerInclude,
    orderBy: { name: "asc" },
  });
  res.json(customers.map(mapCustomer));
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

  const customer = await prisma.customer.create({
    data: parsed.data,
    include: customerInclude,
  });
  res.status(201).json(mapCustomer(customer));
});

customersRouter.patch("/:id", async (req, res) => {
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: req.body,
    include: customerInclude,
  });
  res.json(mapCustomer(customer));
});

customersRouter.post("/:id/pay", async (req, res) => {
  const parsed = z.object({ amount: z.coerce.number().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Write the paid amount." });

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id: req.params.id },
        include: {
          sales: {
            where: { paymentMethod: "CREDIT", status: { not: "VOID" } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!existing) throw new Error("Customer not found.");

      const dueNow = Number(existing.outstanding || 0);
      if (dueNow <= 0) throw new Error("This customer has no remaining amount.");
      const applied = Math.min(parsed.data.amount, dueNow);
      let left = applied;

      for (const sale of existing.sales) {
        if (left <= 0) break;
        const due = Number(sale.total) - Number(sale.paid);
        if (due <= 0) continue;
        const part = Math.min(due, left);
        await tx.sale.update({
          where: { id: sale.id },
          data: { paid: { increment: part } },
        });
        left -= part;
      }

      return tx.customer.update({
        where: { id: existing.id },
        data: { outstanding: { decrement: applied } },
        include: customerInclude,
      });
    });

    res.json(mapCustomer(customer));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not save payment." });
  }
});
