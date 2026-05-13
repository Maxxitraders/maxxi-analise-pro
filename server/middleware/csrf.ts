import crypto from "node:crypto";
import { parse as parseCookies } from "cookie";
import type { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf-sig";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

// Deve ser definido em CSRF_SECRET no .env em produção
const CSRF_SECRET =
  process.env.CSRF_SECRET ?? crypto.randomBytes(32).toString("hex");

const BYPASS_PREFIXES = [
  "/api/asaas/webhook",
  "/api/stripe/webhook",
  "/api/oauth",
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sign(token: string): string {
  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");
}

export function generateCsrfToken(): { token: string; signature: string } {
  const random = crypto.randomBytes(32).toString("hex");
  const token = `${Date.now()}:${random}`;
  return { token, signature: sign(token) };
}

export function setCsrfCookie(res: Response, signature: string): void {
  res.cookie(CSRF_COOKIE, signature, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

function isExpired(token: string): boolean {
  const timestamp = parseInt(token.split(":")[0], 10);
  return isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS;
}

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (BYPASS_PREFIXES.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  const token = req.headers[CSRF_HEADER] as string | undefined;
  const cookies = parseCookies(req.headers.cookie ?? "");
  const cookieSig = cookies[CSRF_COOKIE];

  if (!token || !cookieSig) {
    res.status(403).json({ error: "CSRF token ausente." });
    return;
  }

  if (isExpired(token)) {
    res.status(403).json({ error: "CSRF token expirado." });
    return;
  }

  const expected = sign(token);

  // Buffers devem ter mesmo tamanho para timingSafeEqual
  if (expected.length !== cookieSig.length) {
    res.status(403).json({ error: "CSRF token inválido." });
    return;
  }

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(cookieSig, "hex")
    );
    if (!valid) throw new Error();
  } catch {
    res.status(403).json({ error: "CSRF token inválido." });
    return;
  }

  next();
}
