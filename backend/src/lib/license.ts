import { createHmac } from "node:crypto";
import { appConfig, saveUserSettings, userSettings } from "./appPaths";
import { prisma } from "./prisma";

const PREFIX = "PMS";

function secret() {
  return String(appConfig().licenseSecret || "pms-pharmacy-key-v1-h7n3r9q5").trim();
}

export function normalizeShopName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function normalizeKey(key: string) {
  return String(key || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function digestFor(shopName: string) {
  const body = `pms-shop-v1|${normalizeShopName(shopName).toLowerCase()}`;
  return createHmac("sha256", secret()).update(body).digest("hex").slice(0, 16).toUpperCase();
}

export function formatKey(hex16: string) {
  const raw = String(hex16 || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const chunks = raw.match(/.{1,4}/g) || [];
  return [PREFIX, ...chunks].join("-");
}

export function createLicenseKey(shopName: string) {
  const name = normalizeShopName(shopName);
  if (!name) throw new Error("Write the pharmacy name.");
  return formatKey(digestFor(name));
}

export function verifyLicenseKey(shopName: string, key: string) {
  const name = normalizeShopName(shopName);
  if (!name || !key) return null;
  const got = normalizeKey(key).replace(new RegExp(`^${PREFIX}`), "");
  const want = digestFor(name);
  if (got !== want) return null;
  return name;
}

export function licenseStatus() {
  const settings = userSettings();
  const name = normalizeShopName(settings.licenseShop || "");
  if (!name || !settings.licenseKey) {
    return { licensed: false, shopName: "" };
  }
  const ok = verifyLicenseKey(name, settings.licenseKey);
  return { licensed: Boolean(ok), shopName: ok || "" };
}

export async function activateLicense(shopName: string, key: string) {
  const name = verifyLicenseKey(shopName, key);
  if (!name) throw new Error("Pharmacy name or license key is wrong.");
  saveUserSettings({
    licenseShop: name,
    licenseKey: formatKey(digestFor(name)),
    licensedAt: new Date().toISOString(),
  });
  try {
    const current = await prisma.storeSetting.findFirst();
    if (current) {
      await prisma.storeSetting.update({ where: { id: current.id }, data: { name } });
    }
  } catch {
    // database can be empty on first open
  }
  return { licensed: true, shopName: name };
}
