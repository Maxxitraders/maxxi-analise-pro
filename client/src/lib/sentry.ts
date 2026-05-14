import * as Sentry from "@sentry/react";

const SENSITIVE_KEYS = new Set([
  "password", "passwordhash", "resettoken", "token", "apikey",
  "authorization", "secret", "cpf", "cnpj", "senha",
]);

function scrubFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_KEYS.has(k.toLowerCase()) ? [k, "[Filtered]"] : [k, v]
    )
  );
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
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

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      if (breadcrumb.data) {
        return { ...breadcrumb, data: scrubFields(breadcrumb.data as Record<string, unknown>) };
      }
      return breadcrumb;
    });
  }

  return event;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,

    integrations: [
      Sentry.browserTracingIntegration({
        enableInp: true,
      }),
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
        mask: [".sensitive", "[data-sensitive]"],
        block: [".private", "[data-private]"],
        networkDetailAllowUrls: [window.location.origin],
        networkCaptureBodies: true,
        networkRequestHeaders: ["content-type"],
        networkResponseHeaders: ["content-type"],
      }),
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[400, 599]],
      }),
    ],

    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend: scrubEvent,

    initialScope: {
      tags: { service: "maxxi-analise-frontend" },
    },
  });
}

export { Sentry };
