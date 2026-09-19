import { Router } from "express";
import { prisma } from "../lib/prisma";
import { daysUntil } from "../lib/helpers";
import { authRequired } from "../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(authRequired);

reportsRouter.get("/dashboard", async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todaySales, medicines, batches, customers, recentSales] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: startOfDay }, status: { not: "VOID" } },
      include: { items: true },
    }),
    prisma.medicine.findMany({ include: { batches: true } }),
    prisma.batch.findMany({ include: { medicine: true } }),
    prisma.customer.count(),
    prisma.sale.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { customer: true, createdBy: { select: { name: true } } },
    }),
  ]);

  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const todayCost = todaySales.reduce(
    (sum, s) => sum + s.items.reduce((line, i) => line + Number(i.costPrice) * i.quantity, 0),
    0
  );
  const stockValue = batches.reduce((sum, b) => sum + Number(b.costPrice) * b.quantity, 0);
  const lowStock = medicines.filter((m) => m.batches.reduce((s, b) => s + b.quantity, 0) <= m.reorderLevel).length;
  const nearExpiry = batches.filter((b) => b.quantity > 0 && daysUntil(b.expiryDate) <= 30).length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekSales = await prisma.sale.findMany({
    where: { createdAt: { gte: weekStart }, status: { not: "VOID" } },
    select: { createdAt: true, total: true },
  });
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    const daySales = weekSales.filter((s) => s.createdAt.toISOString().slice(0, 10) === key);
    week.push({
      date: key.slice(5, 10),
      sales: daySales.reduce((sum, s) => sum + Number(s.total), 0),
      bills: daySales.length,
    });
  }

  res.json({
    todayRevenue,
    todayBills: todaySales.length,
    todayProfit: todayRevenue - todayCost,
    stockValue,
    medicineCount: medicines.length,
    customerCount: customers,
    lowStock,
    nearExpiry,
    week,
    recentSales,
  });
});

function periodRange(type: string, dateStr: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return { from: fallback, to: new Date() };
  }
  const year = base.getFullYear();
  const month = base.getMonth();
  if (type === "week") {
    const from = new Date(base);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (type === "month") {
    return {
      from: new Date(year, month, 1, 0, 0, 0, 0),
      to: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }
  if (type === "year") {
    return {
      from: new Date(year, 0, 1, 0, 0, 0, 0),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }
  const from = new Date(year, month, base.getDate(), 0, 0, 0, 0);
  const to = new Date(year, month, base.getDate(), 23, 59, 59, 999);
  return { from, to };
}

reportsRouter.get("/sales", async (req, res) => {
  const type = String(req.query.type || "day");
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const range = req.query.from && req.query.to
    ? { from: new Date(String(req.query.from)), to: new Date(String(req.query.to)) }
    : periodRange(type, date);
  range.to.setHours(23, 59, 59, 999);

  const [sales, purchases, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: range.from, lte: range.to }, status: { not: "VOID" } },
      include: { items: { include: { medicine: true } }, customer: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: { supplier: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: range.from, lte: range.to } },
    }),
  ]);

  const revenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const tax = sales.reduce((sum, s) => sum + Number(s.tax), 0);
  const cost = sales.reduce(
    (sum, s) => sum + s.items.reduce((line, i) => line + Number(i.costPrice) * i.quantity, 0),
    0
  );
  const buys = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const profit = revenue - cost;
  const profitAfterTax = revenue - tax - cost - expensesTotal;

  res.json({
    type,
    from: range.from,
    to: range.to,
    bills: sales.length,
    revenue,
    tax,
    cost,
    buys,
    expenses: expensesTotal,
    profit,
    profitAfterTax,
    sales,
    purchases,
    expenseRows: expenses,
  });
});

reportsRouter.get("/top-medicines", async (_req, res) => {
  const items = await prisma.saleItem.groupBy({
    by: ["medicineId"],
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });

  const medicines = await prisma.medicine.findMany({
    where: { id: { in: items.map((i) => i.medicineId) } },
  });

  res.json(
    items.map((item) => ({
      medicine: medicines.find((m) => m.id === item.medicineId),
      quantity: item._sum.quantity || 0,
      revenue: item._sum.lineTotal || 0,
    }))
  );
});
