import { Router, Request, Response } from "express";
import {
  createSessionCookie,
  validateCredentials,
  getSessionRole,
} from "../lib/auth";

const router = Router();

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    return;
  }
  const role = validateCredentials(username.trim(), password);
  if (!role) {
    res.status(401).json({ error: "Usuário ou senha incorretos" });
    return;
  }
  const cookie = createSessionCookie(role);
  res.cookie("crm_session", cookie, COOKIE_OPTS);
  res.json({ role });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("crm_session");
  res.json({ ok: true });
});

router.get("/me", (req: Request, res: Response) => {
  const role = getSessionRole(req);
  if (!role) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  res.json({ role });
});

export default router;
