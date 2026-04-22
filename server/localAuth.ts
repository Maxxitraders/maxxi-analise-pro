/**
 * Módulo de autenticação local (email/senha).
 * Gerencia registro, login, e recuperação de senha.
 * Clientes usam este sistema; admin usa Manus OAuth.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { notifyOwner } from "./_core/notification";

const SALT_ROUNDS = 10;

function getSecretKey() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

// ── Hash & Verify ──

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Session ──

export async function createLocalSessionToken(userId: number, openId: string, name: string): Promise<string> {
  const secretKey = getSecretKey();
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({
    openId,
    appId: process.env.VITE_APP_ID || "local",
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

// ── Register ──

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ userId: number; openId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  // Verificar se email já existe
  const existing = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Este email já está cadastrado. Faça login ou use outro email.");
  }

  const passwordHash = await hashPassword(params.password);
  // Gerar openId único para o usuário local (prefixo "local_" para distinguir)
  const openId = `local_${randomBytes(16).toString("hex")}`;

  const result = await db.insert(users).values({
    openId,
    name: params.name,
    email: params.email,
    passwordHash,
    loginMethod: "email",
    role: "user",
    lastSignedIn: new Date(),
  });

  const userId = Number(result[0].insertId);

  // Notificar o admin sobre novo cadastro
  try {
    await notifyOwner({
      title: "Novo cadastro na plataforma",
      content: `Novo usuário cadastrado: ${params.name} (${params.email})`,
    });
  } catch {
    // Não bloquear o registro se a notificação falhar
  }

  return { userId, openId };
}

// ── Login ──

export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<{ user: typeof users.$inferSelect; sessionToken: string }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  const result = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (result.length === 0) {
    throw new Error("Email ou senha incorretos.");
  }

  const user = result[0];

  if (!user.passwordHash) {
    throw new Error("Esta conta usa login via Manus. Use o botão 'Entrar com Manus' para acessar.");
  }

  const isValid = await verifyPassword(params.password, user.passwordHash);
  if (!isValid) {
    throw new Error("Email ou senha incorretos.");
  }

  // Atualizar lastSignedIn
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  const sessionToken = await createLocalSessionToken(user.id, user.openId, user.name || "");

  return { user, sessionToken };
}

// ── Reset Password ──

export async function requestPasswordReset(email: string): Promise<{ token: string } | null> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (result.length === 0) {
    // Não revelar se o email existe
    return null;
  }

  const user = result[0];
  if (!user.passwordHash) {
    // Conta OAuth, não tem senha para resetar
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.update(users).set({
    resetToken: token,
    resetTokenExpiry: expiry,
  }).where(eq(users.id, user.id));

  return { token };
}

export async function resetPassword(params: {
  token: string;
  newPassword: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  const result = await db.select().from(users).where(eq(users.resetToken, params.token)).limit(1);
  if (result.length === 0) {
    throw new Error("Token inválido ou expirado.");
  }

  const user = result[0];
  if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
    throw new Error("Token expirado. Solicite uma nova redefinição de senha.");
  }

  const passwordHash = await hashPassword(params.newPassword);

  await db.update(users).set({
    passwordHash,
    resetToken: null,
    resetTokenExpiry: null,
  }).where(eq(users.id, user.id));

  return true;
}

// ── Get user by email ──

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}
