import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const ADMIN_USER = process.env.ADMIN_USER || "eduardo";
const ADMIN_PASS = process.env.ADMIN_PASS!;
const TEAM_USER = process.env.TEAM_USER || "equipe";
const TEAM_PASS = process.env.TEAM_PASS!;

export type UserRole = "admin" | "team";

function sign(value: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function verifyAndDecode(cookie: string): { role: UserRole } | null {
  const dotIdx = cookie.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = cookie.slice(0, dotIdx);
  const sig = cookie.slice(dotIdx + 1);
  if (sign(payload) !== sig) return null;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (parsed.role !== "admin" && parsed.role !== "team") return null;
    return parsed as { role: UserRole };
  } catch {
    return null;
  }
}

export function createSessionCookie(role: UserRole): string {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function getSessionRole(req: Request): UserRole | null {
  const cookie = (req.cookies as Record<string, string>)?.["crm_session"];
  if (!cookie) return null;
  return verifyAndDecode(cookie)?.role ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // ChatGuru webhook must stay public
  if (
    req.path.startsWith("/chatguru/webhook") &&
    req.method === "POST"
  ) {
    next();
    return;
  }
  // Auth routes are public
  if (req.path.startsWith("/auth/")) {
    next();
    return;
  }

  const role = getSessionRole(req);
  if (!role) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  (req as Request & { userRole: UserRole }).userRole = role;
  next();
}

export function validateCredentials(
  username: string,
  password: string
): UserRole | null {
  if (username === ADMIN_USER && password === ADMIN_PASS) return "admin";
  if (username === TEAM_USER && password === TEAM_PASS) return "team";
  return null;
}
