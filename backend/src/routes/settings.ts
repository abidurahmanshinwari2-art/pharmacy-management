import { Router } from "express";
import { z } from "zod";
import { loadDb, newId, withDb } from "../lib/storeDb";
import { authRequired, requireRoles } from "../middleware/auth";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  const settings = loadDb().storeSettings[0];
  res.json({
    name: settings?.name || "Noor Pharmacy",
    tagline: settings?.tagline || "",
  });
});

settingsRouter.use(authRequired);

settingsRouter.get("/", async (_req, res) => {
  const db = loadDb();
  const settings = db.storeSettings[0] || {};
  const locations = db.locations.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  res.json({ ...settings, locations });
});

settingsRouter.put("/", requireRoles("ADMIN"), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2),
      tagline: z.string().optional().default(""),
      address: z.string().min(2),
      phone: z.string().min(5),
      email: z.string().optional().default(""),
      licenseNo: z.string().min(2),
      taxId: z.string().min(2),
      currency: z.string().min(2),
      currencySymbol: z.string().min(1),
      taxName: z.string().min(1),
      taxPercent: z.number().min(0).max(100),
      invoicePrefix: z.string().min(1),
      purchasePrefix: z.string().min(1),
      receiptFooter: z.string().min(2),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Please complete all shop settings." });

  const settings = withDb((db) => {
    if (db.storeSettings[0]) {
      Object.assign(db.storeSettings[0], parsed.data);
      return db.storeSettings[0];
    }
    const created = { id: newId(), ...parsed.data };
    db.storeSettings.push(created);
    return created;
  });
  res.json(settings);
});

settingsRouter.get("/locations", async (_req, res) => {
  const locations = loadDb().locations.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  res.json(locations);
});

settingsRouter.post("/locations", requireRoles("ADMIN", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2), address: z.string().optional().default("") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Room name is required." });
  const room = withDb((db) => {
    const created = { id: newId(), name: parsed.data.name, address: parsed.data.address };
    db.locations.push(created);
    return created;
  });
  res.status(201).json(room);
});

settingsRouter.patch("/locations/:id", requireRoles("ADMIN", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2).optional(), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid room." });
  try {
    const room = withDb((db) => {
      const existing = db.locations.find((item) => item.id === String(req.params.id));
      if (!existing) throw new Error("Room not found.");
      if (parsed.data.name) existing.name = parsed.data.name;
      if (parsed.data.address !== undefined) existing.address = parsed.data.address;
      return existing;
    });
    res.json(room);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid room." });
  }
});
