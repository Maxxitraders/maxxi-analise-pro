import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

// Gerar email único para cada teste
const testEmail = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testName = "Teste Usuário";
const testPassword = "senha123segura";

describe("auth.register", () => {
  it("cria uma nova conta com email e senha e define o cookie de sessão", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.register({
      name: testName,
      email: testEmail,
      password: testPassword,
    });

    expect(result).toEqual({
      success: true,
      message: "Cadastro realizado com sucesso!",
    });

    // Deve ter definido o cookie de sessão
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
    expect(typeof setCookies[0]?.value).toBe("string");
  });

  it("rejeita registro com email duplicado", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Outro Usuário",
        email: testEmail,
        password: "outrasenha123",
      })
    ).rejects.toThrow(/já está cadastrado/);
  });

  it("rejeita registro com nome muito curto", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "A",
        email: `unique_${Date.now()}@example.com`,
        password: "senha123",
      })
    ).rejects.toThrow();
  });

  it("rejeita registro com senha muito curta", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Teste",
        email: `unique2_${Date.now()}@example.com`,
        password: "12345",
      })
    ).rejects.toThrow();
  });
});

describe("auth.login", () => {
  it("faz login com email e senha corretos e define o cookie de sessão", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: testEmail,
      password: testPassword,
    });

    expect(result.success).toBe(true);
    expect(result.userName).toBe(testName);

    // Deve ter definido o cookie de sessão
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
  });

  it("rejeita login com senha incorreta", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: testEmail,
        password: "senhaerrada",
      })
    ).rejects.toThrow(/incorretos/);
  });

  it("rejeita login com email inexistente", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "naoexiste@example.com",
        password: "qualquercoisa",
      })
    ).rejects.toThrow(/incorretos/);
  });
});

describe("auth.requestPasswordReset", () => {
  it("retorna sucesso mesmo para email inexistente (não revela existência)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: "naoexiste@example.com",
      origin: "https://app.maxxianalise.com",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Se o email estiver cadastrado");
  });

  it("retorna sucesso para email existente", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: testEmail,
      origin: "https://app.maxxianalise.com",
    });

    expect(result.success).toBe(true);
  });
});

describe("auth.resetPassword", () => {
  it("rejeita token inválido", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "token_invalido_123",
        newPassword: "novasenha123",
      })
    ).rejects.toThrow(/inválido|expirado/);
  });
});
