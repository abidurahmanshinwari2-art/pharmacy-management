import { Router } from "express";
import { z } from "zod";
import { activateLicense, licenseStatus } from "../lib/license";
import { restoreBackup, saveBackupToComputer } from "../lib/backup";
import { applyUpdate, checkUpdate } from "../lib/updater";
import { appConfig, DATA_DIR, APP_ROOT, githubRepo } from "../lib/appPaths";
import { authRequired, requireRoles } from "../middleware/auth";

export const systemRouter = Router();

systemRouter.get("/health", (_req, res) => {
  const cfg = appConfig();
  const license = licenseStatus();
  res.json({
    ok: true,
    name: "Pharmacy ERP API",
    version: cfg.version,
    offline: true,
    dataPath: DATA_DIR,
    appPath: APP_ROOT,
    githubRepo: githubRepo(),
    licensed: license.licensed,
  });
});

systemRouter.get("/license", (_req, res) => {
  res.json(licenseStatus());
});

systemRouter.post("/license", async (req, res) => {
  const parsed = z.object({
    shopName: z.string().min(2),
    key: z.string().min(8),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Write the pharmacy name and license key." });
  try {
    res.json(activateLicense(parsed.data.shopName, parsed.data.key));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "License key is wrong." });
  }
});

systemRouter.get("/update", async (_req, res) => {
  res.json(await checkUpdate());
});

systemRouter.post("/update/apply", async (_req, res) => {
  res.json(await applyUpdate());
});

systemRouter.post("/backup/save", authRequired, requireRoles("ADMIN"), async (_req, res) => {
  try {
    res.json(await saveBackupToComputer());
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not save backup." });
  }
});

systemRouter.post("/backup/restore", authRequired, requireRoles("ADMIN"), async (req, res) => {
  try {
    res.json(await restoreBackup(req.body));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not load backup." });
  }
});
