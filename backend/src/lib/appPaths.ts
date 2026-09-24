import fs from "node:fs";
import path from "node:path";

export const APP_ROOT = path.resolve(__dirname, "../../..");
export const DATA_DIR = path.join(APP_ROOT, "pharmacy-data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CONFIG_FILE = path.join(APP_ROOT, "backend", "config.json");

export type AppConfig = {
  version: string;
  port: number;
  githubRepo: string;
  licenseSecret: string;
  jwtSecret?: string;
};

export type UserSettings = {
  licenseShop?: string;
  licenseKey?: string;
  licensedAt?: string;
  githubRepo?: string;
  installedId?: string;
};

export function appConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { version: "1.0.0", port: 4050, githubRepo: "", licenseSecret: "pms-pharmacy-key-v1-h7n3r9q5", jwtSecret: "pms-jwt-v1" };
  }
}

export function userSettings(): UserSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveUserSettings(next: Partial<UserSettings>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const merged = { ...userSettings(), ...next };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

export function githubRepo() {
  return String(userSettings().githubRepo || appConfig().githubRepo || "").trim();
}

export function backupsDir() {
  const folder = path.join(DATA_DIR, "backups");
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}
