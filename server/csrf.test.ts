import crypto from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  generateCsrfToken,
  setCsrfCookie,
  csrfMiddleware,
} from "./middleware/csrf";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    path: "/api/trpc/some.procedure",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
  lastStatus: number;
  lastBody: unknown;
};

function makeRes(): MockRes {
  const mock: MockRes = {
    lastStatus: 200,
    lastBody: null,
    cookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  mock.status.mockImplementation((code: number) => {
    mock.lastStatus = code;
    return { json: mock.json };
  });
  mock.json.mockImplementation((body: unknown) => {
    mock.lastBody = body;
  });
  return mock;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── generateCsrfToken ─────────────────────────────────────────────────────────

describe("generateCsrfToken", () => {
  it("retorna token e signature como strings não-vazias", () => {
    const { token, signature } = generateCsrfToken();
    expect(typeof token).toBe("string");
    expect(typeof signature).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(signature.length).toBe(64); // HMAC-SHA256 hex = 64 chars
  });

  it("token contém timestamp válido como primeiro segmento", () => {
    const { token } = generateCsrfToken();
    const timestamp = parseInt(token.split(":")[0], 10);
    expect(isNaN(timestamp)).toBe(false);
    expect(timestamp).toBeGreaterThan(0);
    expect(Date.now() - timestamp).toBeLessThan(1000); // gerado há menos de 1s
  });

  it("gera tokens únicos a cada chamada", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a.token).not.toBe(b.token);
    expect(a.signature).not.toBe(b.signature);
  });
});

// ── setCsrfCookie ─────────────────────────────────────────────────────────────

describe("setCsrfCookie", () => {
  it("chama res.cookie com opções httpOnly e sameSite=strict", () => {
    const res = makeRes();
    setCsrfCookie(res as unknown as Response, "test-sig");

    expect(res.cookie).toHaveBeenCalledOnce();
    const [name, value, opts] = res.cookie.mock.calls[0];
    expect(name).toBe("csrf-sig");
    expect(value).toBe("test-sig");
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("strict");
    expect(opts.maxAge).toBe(60 * 60 * 1000);
  });
});

// ── csrfMiddleware ────────────────────────────────────────────────────────────

describe("csrfMiddleware — bypass de métodos seguros", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("chama next() para método %s", (method) => {
    const req = makeReq({ method });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("csrfMiddleware — bypass de webhooks", () => {
  it.each([
    "/api/asaas/webhook",
    "/api/stripe/webhook",
    "/api/oauth/callback",
  ])("chama next() para path %s", (path) => {
    const req = makeReq({ method: "POST", path });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("csrfMiddleware — token ausente", () => {
  it("retorna 403 quando header X-CSRF-Token não enviado", () => {
    const { signature } = generateCsrfToken();
    const req = makeReq({
      headers: { cookie: `csrf-sig=${signature}` },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retorna 403 quando cookie csrf-sig não enviado", () => {
    const { token } = generateCsrfToken();
    const req = makeReq({
      headers: { "x-csrf-token": token },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("csrfMiddleware — token válido", () => {
  it("chama next() quando token e cookie são válidos", () => {
    const { token, signature } = generateCsrfToken();
    const req = makeReq({
      headers: {
        "x-csrf-token": token,
        cookie: `csrf-sig=${signature}`,
      },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("csrfMiddleware — token inválido", () => {
  it("retorna 403 quando signature foi adulterada", () => {
    const { token } = generateCsrfToken();
    const fakeSignature = "a".repeat(64); // 64 chars mas HMAC errado
    const req = makeReq({
      headers: {
        "x-csrf-token": token,
        cookie: `csrf-sig=${fakeSignature}`,
      },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retorna 403 quando token foi trocado mas cookie é de outro token", () => {
    const first = generateCsrfToken();
    const second = generateCsrfToken();

    // Envia token do segundo com signature do primeiro
    const req = makeReq({
      headers: {
        "x-csrf-token": second.token,
        cookie: `csrf-sig=${first.signature}`,
      },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("csrfMiddleware — token expirado", () => {
  it("retorna 403 quando timestamp do token excede 1 hora", () => {
    const umaHoraAtras = Date.now() - 61 * 60 * 1000; // 61 min atrás
    const random = crypto.randomBytes(32).toString("hex");
    const expiredToken = `${umaHoraAtras}:${random}`;

    const req = makeReq({
      headers: {
        "x-csrf-token": expiredToken,
        cookie: `csrf-sig=qualquer-coisa`,
      },
    });
    const res = makeRes();
    const next = makeNext();

    csrfMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("expirado") })
    );
  });
});
