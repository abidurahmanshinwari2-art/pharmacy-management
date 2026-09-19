import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { Role } from "@prisma/client";

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

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev") as AuthUser;
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

export async function writeAudit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details },
  });
}
