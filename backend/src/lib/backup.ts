import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupsDir, saveUserSettings, userSettings } from "./appPaths";
import { emptyDb, loadDb, saveDb, type PharmacyDb } from "./storeDb";

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

export function makeBackup() {
  const db = loadDb();
  const settings = userSettings();
  const shop = settings.licenseShop || db.storeSettings[0]?.name || "pharmacy";

  return {
    kind: KIND,
    version: 1,
    createdAt: new Date().toISOString(),
    shopName: shop,
    data: db,
    settings: {
      githubRepo: settings.githubRepo || "",
      licenseShop: settings.licenseShop || "",
      licenseKey: settings.licenseKey || "",
      licensedAt: settings.licensedAt || "",
      installedId: settings.installedId || "",
    },
  };
}

export function saveBackupToComputer() {
  const pack = makeBackup();
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

export function restoreBackup(pack: any) {
  if (!pack || pack.kind !== KIND || !pack.data || typeof pack.data !== "object") {
    throw new Error("This file is not a pharmacy backup.");
  }
  const data = pack.data as PharmacyDb;
  if (!Array.isArray(data.users) || !Array.isArray(data.medicines) || !Array.isArray(data.sales)) {
    throw new Error("This backup file is not complete.");
  }
  const next = emptyDb();
  for (const key of Object.keys(next) as (keyof PharmacyDb)[]) {
    next[key] = Array.isArray(data[key]) ? data[key] : [];
  }
  saveDb(next);

  const extra = pack.settings && typeof pack.settings === "object" ? pack.settings : {};
  const now = userSettings();
  saveUserSettings({
    githubRepo: extra.githubRepo || now.githubRepo || "",
    licenseShop: extra.licenseShop || now.licenseShop || "",
    licenseKey: extra.licenseKey || now.licenseKey || "",
    licensedAt: extra.licensedAt || now.licensedAt || "",
    installedId: extra.installedId || now.installedId || "",
  });
  return { ok: true, message: "Backup is loaded. Pharmacy data on this PC is now this file." };
}
