import { Router } from "express";
import { daysUntil } from "../lib/helpers";
import { loadDb, stockOf } from "../lib/storeDb";
import { authRequired } from "../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(authRequired);

function inRange(value: string | Date, from: Date, to: Date) {
  const time = new Date(value).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

reportsRouter.get("/dashboard", async (_req, res) => {
  const db = loadDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySales = db.sales.filter((s) => s.status !== "VOID" && new Date(s.createdAt) >= startOfDay);
  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const todayCost = todaySales.reduce((sum, s) => {
    const items = db.saleItems.filter((i) => i.saleId === s.id);
    return sum + items.reduce((line, i) => line + Number(i.costPrice) * i.quantity, 0);
  }, 0);
  const stockValue = db.batches.reduce((sum, b) => sum + Number(b.costPrice) * Number(b.quantity), 0);
  const lowStock = db.medicines.filter((m) => stockOf(db, m.id) <= m.reorderLevel).length;
  const nearExpiry = db.batches.filter((b) => Number(b.quantity) > 0 && daysUntil(b.expiryDate) <= 30).length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekSales = db.sales.filter((s) => s.status !== "VOID" && new Date(s.createdAt) >= weekStart);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    const daySales = weekSales.filter((s) => new Date(s.createdAt).toISOString().slice(0, 10) === key);
    week.push({
      date: key.slice(5, 10),
      sales: daySales.reduce((sum, s) => sum + Number(s.total), 0),
      bills: daySales.length,
    });
  }

  const recentSales = db.sales
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((sale) => {
      const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : null;
      const user = db.users.find((u) => u.id === sale.createdById);
      return { ...sale, customer, createdBy: { name: user?.name || "" } };
    });

  res.json({
    todayRevenue,
    todayBills: todaySales.length,
    todayProfit: todayRevenue - todayCost,
    stockValue,
    medicineCount: db.medicines.length,
    customerCount: db.customers.length,
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
  const db = loadDb();
  const type = String(req.query.type || "day");
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const range = req.query.from && req.query.to
    ? { from: new Date(String(req.query.from)), to: new Date(String(req.query.to)) }
    : periodRange(type, date);
  range.to.setHours(23, 59, 59, 999);

  const sales = db.sales
    .filter((s) => s.status !== "VOID" && inRange(s.createdAt, range.from, range.to))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((sale) => {
      const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : null;
      const user = db.users.find((u) => u.id === sale.createdById);
      const items = db.saleItems
        .filter((i) => i.saleId === sale.id)
        .map((item) => ({ ...item, medicine: db.medicines.find((m) => m.id === item.medicineId) || null }));
      return { ...sale, items, customer, createdBy: { name: user?.name || "" } };
    });
  const purchases = db.purchases
    .filter((p) => inRange(p.createdAt, range.from, range.to))
    .map((p) => ({ ...p, supplier: db.suppliers.find((s) => s.id === p.supplierId) || null }));
  const expenses = db.expenses.filter((e) => inRange(e.date, range.from, range.to));

  const revenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const tax = sales.reduce((sum, s) => sum + Number(s.tax), 0);
  const cost = sales.reduce(
    (sum, s) => sum + s.items.reduce((line: number, i: { costPrice: number; quantity: number }) => line + Number(i.costPrice) * i.quantity, 0),
    0
  );
  const buys = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

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
    profit: revenue - cost,
    profitAfterTax: revenue - tax - cost - expensesTotal,
    sales,
    purchases,
    expenseRows: expenses,
  });
});

reportsRouter.get("/top-medicines", async (_req, res) => {
  const db = loadDb();
  const totals = new Map<string, { quantity: number; revenue: number }>();
  for (const item of db.saleItems) {
    const current = totals.get(item.medicineId) || { quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.lineTotal || 0);
    totals.set(item.medicineId, current);
  }
  const items = [...totals.entries()]
    .map(([medicineId, sum]) => ({ medicineId, ...sum }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  res.json(
    items.map((item) => ({
      medicine: db.medicines.find((m) => m.id === item.medicineId) || null,
      quantity: item.quantity,
      revenue: item.revenue,
    }))
  );
});
