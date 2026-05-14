import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const SENSITIVE_KEYS = new Set([
  "password", "passwordhash", "resettoken", "token", "apikey",
  "authorization", "secret", "cpf", "cnpj", "creditcard", "cvv", "pan",
  "senha",
]);

function scrubFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_KEYS.has(k.toLowerCase()) ? [k, "[Filtered]"] : [k, v]
    )
  );
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubFields(
        event.request.headers as Record<string, unknown>
      ) as Record<string, string>;
    }
    if (event.request.data && typeof event.request.data === "object") {
      event.request.data = scrubFields(
        event.request.data as Record<string, unknown>
      );
    }
    delete event.request.cookies;
  }
  return event;
}

export function initSentry(): void {
  if (!process.env.SENTRY_DSN) {
    console.warn("SENTRY_DSN não configurado - Sentry desabilitado");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    enabled: process.env.NODE_ENV === "production",

    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],

    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,

    beforeSend: scrubEvent,

    initialScope: {
      tags: { service: "maxxi-analise-backend" },
    },
  });
}

export { Sentry };
