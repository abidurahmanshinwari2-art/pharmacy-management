import { prisma } from "./prisma";

export function money(value: number | string) {
  return Number(value).toFixed(2);
}

export async function nextNumber(kind: "INV" | "PO") {
  const settings = await prisma.storeSetting.findFirst();
  const prefix = kind === "INV" ? settings?.invoicePrefix || "INV" : settings?.purchasePrefix || "PO";
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, "");
  const start = `${prefix}-${stamp}-`;

  if (kind === "INV") {
    const last = await prisma.sale.findFirst({
      where: { invoiceNo: { startsWith: start } },
      orderBy: { invoiceNo: "desc" },
    });
    const next = last ? Number(last.invoiceNo.slice(-4)) + 1 : 1;
    return `${start}${String(next).padStart(4, "0")}`;
  }

  const last = await prisma.purchase.findFirst({
    where: { invoiceNo: { startsWith: start } },
    orderBy: { invoiceNo: "desc" },
  });
  const next = last ? Number(last.invoiceNo.slice(-4)) + 1 : 1;
  return `${start}${String(next).padStart(4, "0")}`;
}

export function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
