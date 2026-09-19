import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, requireRoles } from "../middleware/auth";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  const settings = await prisma.storeSetting.findFirst();
  res.json({
    name: settings?.name || "Noor Pharmacy",
    tagline: settings?.tagline || "",
  });
});

settingsRouter.use(authRequired);

settingsRouter.get("/", async (_req, res) => {
  const settings = await prisma.storeSetting.findFirst();
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
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

  const existing = await prisma.storeSetting.findFirst();
  const settings = existing
    ? await prisma.storeSetting.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.storeSetting.create({ data: parsed.data });

  res.json(settings);
});

settingsRouter.get("/locations", async (_req, res) => {
  res.json(await prisma.location.findMany({ orderBy: { name: "asc" } }));
});

settingsRouter.post("/locations", requireRoles("ADMIN", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2), address: z.string().optional().default("") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Room name is required." });
  res.status(201).json(await prisma.location.create({ data: parsed.data }));
});

settingsRouter.patch("/locations/:id", requireRoles("ADMIN", "STOREKEEPER"), async (req, res) => {
  const parsed = z.object({ name: z.string().min(2).optional(), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid room." });
  res.json(await prisma.location.update({ where: { id: String(req.params.id) }, data: parsed.data }));
});
