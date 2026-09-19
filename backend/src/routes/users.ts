import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(authRequired, requireRoles("ADMIN"));

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["ADMIN", "PHARMACIST", "CASHIER", "STOREKEEPER", "ACCOUNTANT"]),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Please fill name, email, password and role." });
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return res.status(409).json({ message: "A user with this email already exists." });

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await writeAudit(req.user?.id, "CREATE", "User", user.id, user.email);
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2).optional(),
      role: z.enum(["ADMIN", "PHARMACIST", "CASHIER", "STOREKEEPER", "ACCOUNTANT"]).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Invalid user update." });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    delete data.password;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ message: "User not found." });
  if (target.id === req.user!.id) {
    return res.status(400).json({ message: "You cannot change or delete your own account." });
  }
  if (target.role === "ADMIN" && parsed.data.isActive === false) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) return res.status(400).json({ message: "Keep at least one admin." });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  await writeAudit(req.user?.id, "UPDATE", "User", user.id);
  res.json(user);
});

usersRouter.delete("/:id", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ message: "User not found." });
  if (target.id === req.user!.id) {
    return res.status(400).json({ message: "You cannot change or delete your own account." });
  }
  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) return res.status(400).json({ message: "Keep at least one admin." });
  }
  const [salesCount, purchasesCount, returnsCount] = await Promise.all([
    prisma.sale.count({ where: { createdById: target.id } }),
    prisma.purchase.count({ where: { createdById: target.id } }),
    prisma.saleReturn.count({ where: { createdById: target.id } }),
  ]);
  const used = salesCount + purchasesCount + returnsCount;
  if (used) {
    await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
  } else {
    await prisma.user.delete({ where: { id: target.id } });
  }
  await writeAudit(req.user?.id, "DELETE", "User", target.id, target.email);
  res.json({ ok: true });
});
