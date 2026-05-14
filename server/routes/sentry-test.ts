import { Router } from "express";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";

const router = Router();

router.get("/test-sentry-error", (_req, _res) => {
  logger.info("Gerando erro de teste para Sentry");
  throw new Error("Teste Sentry Backend - Este erro é intencional");
});

router.get("/test-sentry-transaction", async (_req, res) => {
  await Sentry.startSpan(
    { op: "test", name: "Test Transaction" },
    async (span) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logger.info("Span de teste concluído");
      res.json({
        success: true,
        message: "Span enviado para Sentry",
        spanId: span.spanContext().spanId,
      });
    }
  );
});

router.get("/test-sentry-breadcrumbs", (_req, res) => {
  Sentry.addBreadcrumb({
    category: "test",
    message: "Breadcrumb de teste 1",
    level: "info",
  });
  Sentry.addBreadcrumb({
    category: "test",
    message: "Breadcrumb de teste 2",
    level: "warning",
  });
  logger.info("Breadcrumbs de teste registrados");
  res.json({ success: true, message: "Breadcrumbs registrados" });
});

export default router;
