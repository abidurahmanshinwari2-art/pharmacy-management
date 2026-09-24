import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { loadDb, newId, nowIso, withDb } from "../lib/storeDb";
import { authRequired, requireRoles, writeAudit } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(authRequired, requireRoles("ADMIN"));

function publicUser(user: any) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
}

usersRouter.get("/", async (_req, res) => {
  const users = loadDb().users.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  res.json(users.map(publicUser));
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

  try {
    const user = withDb((db) => {
      if (db.users.some((u) => u.email === parsed.data.email)) {
        throw new Error("exists");
      }
      const created = {
        id: newId(),
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: bcrypt.hashSync(parsed.data.password, 10),
        role: parsed.data.role,
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.users.push(created);
      return created;
    });
    await writeAudit(req.user?.id, "CREATE", "User", user.id, user.email);
    res.status(201).json(publicUser(user));
  } catch (error) {
    if (error instanceof Error && error.message === "exists") {
      return res.status(409).json({ message: "A user with this email already exists." });
    }
    res.status(400).json({ message: "Could not add user." });
  }
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

  try {
    const user = withDb((db) => {
      const target = db.users.find((u) => u.id === req.params.id);
      if (!target) throw new Error("User not found.");
      if (target.id === req.user!.id) throw new Error("You cannot change or delete your own account.");
      if (target.role === "ADMIN" && parsed.data.isActive === false) {
        const admins = db.users.filter((u) => u.role === "ADMIN" && u.isActive).length;
        if (admins <= 1) throw new Error("Keep at least one admin.");
      }
      if (parsed.data.name) target.name = parsed.data.name;
      if (parsed.data.role) target.role = parsed.data.role;
      if (parsed.data.isActive !== undefined) target.isActive = parsed.data.isActive;
      if (parsed.data.password) target.passwordHash = bcrypt.hashSync(parsed.data.password, 10);
      target.updatedAt = nowIso();
      return target;
    });
    await writeAudit(req.user?.id, "UPDATE", "User", user.id);
    res.json(publicUser(user));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid user update." });
  }
});

usersRouter.delete("/:id", async (req, res) => {
  try {
    const target = withDb((db) => {
      const user = db.users.find((u) => u.id === req.params.id);
      if (!user) throw new Error("User not found.");
      if (user.id === req.user!.id) throw new Error("You cannot change or delete your own account.");
      if (user.role === "ADMIN") {
        const admins = db.users.filter((u) => u.role === "ADMIN" && u.isActive).length;
        if (admins <= 1) throw new Error("Keep at least one admin.");
      }
      const used =
        db.sales.filter((s) => s.createdById === user.id).length +
        db.purchases.filter((p) => p.createdById === user.id).length +
        db.saleReturns.filter((r) => r.createdById === user.id).length;
      if (used) {
        user.isActive = false;
        user.updatedAt = nowIso();
      } else {
        db.users = db.users.filter((u) => u.id !== user.id);
      }
      return user;
    });
    await writeAudit(req.user?.id, "DELETE", "User", target.id, target.email);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Could not delete user." });
  }
});
