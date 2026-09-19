import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupsDir, saveUserSettings, userSettings } from "./appPaths";
import { prisma } from "./prisma";

const KIND = "pms-backup";

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function fileName(shop: string) {
  const safe = String(shop || "pharmacy").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "pharmacy";
  return `${safe}-backup-${stamp()}.json`;
}

function desktopDir() {
  const home = os.homedir();
  for (const folder of [path.join(home, "Desktop"), path.join(home, "OneDrive", "Desktop")]) {
    if (fs.existsSync(folder)) return folder;
  }
  return null;
}

function jsonSafe(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = jsonSafe(item);
    return out;
  }
  return value;
}

export async function makeBackup() {
  const [
    users,
    storeSettings,
    locations,
    categories,
    suppliers,
    customers,
    medicines,
    batches,
    purchases,
    purchaseItems,
    sales,
    saleItems,
    saleReturns,
    saleReturnItems,
    stockAdjustments,
    expenses,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.storeSetting.findMany(),
    prisma.location.findMany(),
    prisma.category.findMany(),
    prisma.supplier.findMany(),
    prisma.customer.findMany(),
    prisma.medicine.findMany(),
    prisma.batch.findMany(),
    prisma.purchase.findMany(),
    prisma.purchaseItem.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.saleReturn.findMany(),
    prisma.saleReturnItem.findMany(),
    prisma.stockAdjustment.findMany(),
    prisma.expense.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const settings = userSettings();
  const shop = settings.licenseShop || storeSettings[0]?.name || "pharmacy";

  return {
    kind: KIND,
    version: 1,
    createdAt: new Date().toISOString(),
    shopName: shop,
    data: jsonSafe({
      users,
      storeSettings,
      locations,
      categories,
      suppliers,
      customers,
      medicines,
      batches,
      purchases,
      purchaseItems,
      sales,
      saleItems,
      saleReturns,
      saleReturnItems,
      stockAdjustments,
      expenses,
      auditLogs,
    }),
    settings: {
      githubRepo: settings.githubRepo || "",
      licenseShop: settings.licenseShop || "",
      licenseKey: settings.licenseKey || "",
      licensedAt: settings.licensedAt || "",
      installedId: settings.installedId || "",
    },
  };
}

export async function saveBackupToComputer() {
  const pack = await makeBackup();
  const name = fileName(String(pack.shopName || "pharmacy"));
  const savedIn = path.join(backupsDir(), name);
  fs.writeFileSync(savedIn, JSON.stringify(pack, null, 2));

  let desktop = "";
  const desk = desktopDir();
  if (desk) {
    try {
      desktop = path.join(desk, name);
      fs.copyFileSync(savedIn, desktop);
    } catch {
      desktop = "";
    }
  }

  return {
    ok: true,
    fileName: name,
    savedIn,
    desktop,
    pack,
    message: desktop
      ? "Backup is on this PC (Desktop and the pharmacy backups folder). Copy that file to USB or another computer."
      : `Backup is on this PC in ${path.dirname(savedIn)}. Copy that file to USB or another computer.`,
  };
}

export async function restoreBackup(pack: any) {
  if (!pack || pack.kind !== KIND || !pack.data || typeof pack.data !== "object") {
    throw new Error("This file is not a pharmacy backup.");
  }
  const data = pack.data;
  if (!Array.isArray(data.users) || !Array.isArray(data.medicines) || !Array.isArray(data.sales)) {
    throw new Error("This backup file is not complete.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.saleReturnItem.deleteMany();
    await tx.saleReturn.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.sale.deleteMany();
    await tx.stockAdjustment.deleteMany();
    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();
    await tx.batch.deleteMany();
    await tx.medicine.deleteMany();
    await tx.category.deleteMany();
    await tx.customer.deleteMany();
    await tx.expense.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.supplier.deleteMany();
    await tx.location.deleteMany();
    await tx.user.deleteMany();
    await tx.storeSetting.deleteMany();

    if (data.storeSettings?.length) await tx.storeSetting.createMany({ data: data.storeSettings });
    if (data.users?.length) await tx.user.createMany({ data: data.users });
    if (data.locations?.length) await tx.location.createMany({ data: data.locations });
    if (data.suppliers?.length) await tx.supplier.createMany({ data: data.suppliers });
    if (data.categories?.length) await tx.category.createMany({ data: data.categories });
    if (data.customers?.length) await tx.customer.createMany({ data: data.customers });
    if (data.medicines?.length) await tx.medicine.createMany({ data: data.medicines });
    if (data.batches?.length) await tx.batch.createMany({ data: data.batches });
    if (data.purchases?.length) await tx.purchase.createMany({ data: data.purchases });
    if (data.purchaseItems?.length) await tx.purchaseItem.createMany({ data: data.purchaseItems });
    if (data.sales?.length) await tx.sale.createMany({ data: data.sales });
    if (data.saleItems?.length) await tx.saleItem.createMany({ data: data.saleItems });
    if (data.saleReturns?.length) await tx.saleReturn.createMany({ data: data.saleReturns });
    if (data.saleReturnItems?.length) await tx.saleReturnItem.createMany({ data: data.saleReturnItems });
    if (data.stockAdjustments?.length) await tx.stockAdjustment.createMany({ data: data.stockAdjustments });
    if (data.expenses?.length) await tx.expense.createMany({ data: data.expenses });
    if (data.auditLogs?.length) await tx.auditLog.createMany({ data: data.auditLogs });
  }, { timeout: 120000 });

  const next = pack.settings && typeof pack.settings === "object" ? pack.settings : {};
  const now = userSettings();
  saveUserSettings({
    githubRepo: next.githubRepo || now.githubRepo || "",
    licenseShop: next.licenseShop || now.licenseShop || "",
    licenseKey: next.licenseKey || now.licenseKey || "",
    licensedAt: next.licensedAt || now.licensedAt || "",
    installedId: next.installedId || now.installedId || "",
  });
  return { ok: true, message: "Backup is loaded. Pharmacy data on this PC is now this file." };
}
