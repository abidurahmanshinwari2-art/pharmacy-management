import { loadDb } from "./storeDb";

export function money(value: number | string) {
  return Number(value).toFixed(2);
}

export function nextNumber(kind: "INV" | "PO") {
  const db = loadDb();
  const settings = db.storeSettings[0];
  const prefix = kind === "INV" ? settings?.invoicePrefix || "INV" : settings?.purchasePrefix || "PO";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const start = `${prefix}-${stamp}-`;
  const list = kind === "INV" ? db.sales : db.purchases;
  const last = list
    .filter((row) => String(row.invoiceNo || "").startsWith(start))
    .sort((a, b) => String(b.invoiceNo).localeCompare(String(a.invoiceNo)))[0];
  const next = last ? Number(String(last.invoiceNo).slice(-4)) + 1 : 1;
  return `${start}${String(next).padStart(4, "0")}`;
}

export function daysUntil(date: Date | string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}
