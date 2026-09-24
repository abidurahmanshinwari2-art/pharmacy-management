import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../lib/appPaths";
import { newId, nowIso, withDb } from "../lib/storeDb";

export type Role = "ADMIN" | "PHARMACIST" | "CASHIER" | "STOREKEEPER" | "ACCOUNTANT";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret() {
  return String((appConfig() as { jwtSecret?: string }).jwtSecret || process.env.JWT_SECRET || "pms-jwt-v1");
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret()) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this action." });
    }
    next();
  };
}

export function writeAudit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  withDb((db) => {
    db.auditLogs.push({
      id: newId(),
      userId: userId || null,
      action,
      entity,
      entityId: entityId || null,
      details: details || null,
      createdAt: nowIso(),
    });
  });
}

export { jwtSecret };
