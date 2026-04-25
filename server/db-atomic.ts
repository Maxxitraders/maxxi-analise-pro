/**
 * Funções de Banco com Transações Atômicas
 * PREVINE: Race Condition
 */
import { sql } from "drizzle-orm";
import { users, transactions } from "../drizzle/schema";
import { getDb } from "./db";

export async function debitSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  bureauTipo?: 'boa_vista' | 'serasa_premium' | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT id, saldo FROM users WHERE id = ${userId} FOR UPDATE
    `);
    const user = (result[0] as unknown as any[])[0];

    if (!user) throw new Error('Usuário não encontrado');
    if (Number(user.saldo) < valor) throw new Error('Saldo insuficiente');

    await tx.execute(sql`
      UPDATE users SET saldo = saldo - ${valor} WHERE id = ${userId}
    `);

    await tx.insert(transactions).values({
      userId,
      tipo: 'consulta',
      valor: String(valor),
      descricao,
      bureauTipo,
      createdAt: new Date(),
    });
  });
}

export async function creditSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  asaasPaymentId?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users SET saldo = saldo + ${valor} WHERE id = ${userId}
    `);

    await tx.insert(transactions).values({
      userId,
      tipo: 'recarga',
      valor: String(valor),
      descricao,
      asaasPaymentId,
      createdAt: new Date(),
    });
  });
}

export async function estornarSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  bureauTipo?: 'boa_vista' | 'serasa_premium' | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users SET saldo = saldo + ${valor} WHERE id = ${userId}
    `);

    await tx.insert(transactions).values({
      userId,
      tipo: 'estorno',
      valor: String(valor),
      descricao,
      bureauTipo,
      createdAt: new Date(),
    });
  });
}

export async function consultarCreditoComTransacao(
  userId: number,
  cpfCnpj: string,
  bureauTipo: 'boa_vista' | 'serasa_premium',
  preco: number,
  consultarFn: () => Promise<any>
): Promise<any> {
  await debitSaldoAtomic(
    userId,
    preco,
    `Consulta ${bureauTipo} - CPF/CNPJ ${cpfCnpj.slice(0, 3)}***`,
    bureauTipo
  );

  try {
    return await consultarFn();
  } catch (error) {
    await estornarSaldoAtomic(
      userId,
      preco,
      `Estorno - Falha na consulta ${bureauTipo}`,
      bureauTipo
    );
    throw error;
  }
}
