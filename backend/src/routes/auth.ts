import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { loadDb } from "../lib/storeDb";
import { authRequired, jwtSecret } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Enter a valid email and password." });
  }

  const user = loadDb().users.find((u) => u.email === parsed.data.email);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret(),
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRouter.get("/me", authRequired, async (req, res) => {
  const user = loadDb().users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(401).json({ message: "Please sign in to continue." });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});
