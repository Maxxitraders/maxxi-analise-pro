import "dotenv/config";
import { initSentry, Sentry } from "../sentry";
initSentry();
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStripeWebhook } from "../stripeWebhook";
import { handleAsaasWebhook } from "../asaasWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { globalLimiter, webhookLimiter } from "../rateLimiting";
import { csrfMiddleware, generateCsrfToken, setCsrfCookie } from "../middleware/csrf";
import logger from "../utils/logger";
import sentryTestRoutes from "../routes/sentry-test";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Security Headers ──
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled to allow Vite/React in dev
    crossOriginEmbedderPolicy: false,
  }));// ── CORS Configuration ──
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://app.maxxianalise.com', 'https://maxxi-analise-pro-production.up.railway.app']
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-CSRF-Token'],
  }));

  // ── Rate Limiting ──
  // Auth endpoints: 10 attempts per 15 min per IP (brute force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  });

  // Password reset: 5 attempts per hour per IP
  const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas solicitações de recuperação de senha. Tente novamente em 1 hora." },
  });

  app.use("/api/trpc", globalLimiter);
  app.use("/api/trpc/auth.login", authLimiter);
  app.use("/api/trpc/auth.register", authLimiter);
  app.use("/api/trpc/auth.requestPasswordReset", resetLimiter);

  // Stripe webhook MUST be registered BEFORE express.json()
  registerStripeWebhook(app);
  // Configure body parser with reasonable limits
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));
  // Asaas webhook (after express.json)
  app.post("/api/asaas/webhook", webhookLimiter, handleAsaasWebhook);

  // ── CSRF Protection ──
  // GET /api/csrf-token: fornece token para o frontend (não precisa de CSRF — é GET)
  app.get("/api/csrf-token", (_req, res) => {
    const { token, signature } = generateCsrfToken();
    setCsrfCookie(res, signature);
    res.json({ token });
  });
  // Valida token em POST/PUT/DELETE/PATCH (exceto webhooks e OAuth)
  app.use(csrfMiddleware);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Rotas de debug Sentry (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/debug", sentryTestRoutes);
    logger.info("Rotas de debug Sentry habilitadas: /api/debug/test-sentry-*");
  }

  // Sentry error handler — deve vir após todas as rotas
  Sentry.setupExpressErrorHandler(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((error) => logger.error('Failed to start server', { error }));
