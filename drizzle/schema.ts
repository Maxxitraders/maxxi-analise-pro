import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  cpfCnpj: varchar("cpfCnpj", { length: 32 }),
  phone: varchar("phone", { length: 32 }),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Stripe fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  // Asaas fields
  asaasCustomerId: varchar("asaasCustomerId", { length: 128 }),
  asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 128 }),
  planId: varchar("planId", { length: 32 }).default("none"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }).default("none"),
  consultasUsedThisMonth: int("consultasUsedThisMonth").default(0),
  consultasResetAt: timestamp("consultasResetAt"),
  saldo: decimal("saldo", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  monthlyPrice: int("monthlyPrice").notNull(), // em centavos BRL
  consultasLimit: int("consultasLimit").notNull(), // -1 = ilimitado
  features: json("features").$type<string[]>().notNull(),
  popular: boolean("popular").default(false),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  stripeProductId: varchar("stripeProductId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

export const creditAnalyses = mysqlTable("credit_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  documentType: varchar("documentType", { length: 4 }).default("cnpj"),
  companyName: varchar("companyName", { length: 255 }),
  situacao: varchar("situacao", { length: 32 }),
  dataAbertura: varchar("dataAbertura", { length: 16 }),
  capitalSocial: decimal("capitalSocial", { precision: 15, scale: 2 }),
  naturezaJuridica: varchar("naturezaJuridica", { length: 128 }),
  score: int("score"),
  hasProtestos: boolean("hasProtestos").default(false),
  valorDivida: decimal("valorDivida", { precision: 15, scale: 2 }),
  quantidadeRestricoes: int("quantidadeRestricoes").default(0),
  status: mysqlEnum("status", ["APROVADO", "REPROVADO", "ANALISE_MANUAL"]).notNull(),
  motivo: text("motivo"),
  alertSent: boolean("alertSent").default(false),
  pdfUrl: text("pdfUrl"),
  nomeFantasia: varchar("nomeFantasia", { length: 255 }),
  atividadePrincipal: text("atividadePrincipal"),
  endereco: text("endereco"),
  bairro: varchar("bairro", { length: 128 }),
  cidade: varchar("cidade", { length: 128 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 12 }),
  telefone: varchar("telefone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  porte: varchar("porte", { length: 64 }),
  socios: text("socios"),
  scoreMensagem: text("scoreMensagem"),
  protestosJson: text("protestosJson"),
  pendenciasJson: text("pendenciasJson"),
  chequesSemFundo: int("chequesSemFundo").default(0),
  chequesSustados: int("chequesSustados").default(0),
  cadastralDataSource: varchar("cadastralDataSource", { length: 32 }),
  creditDataSource: varchar("creditDataSource", { length: 32 }),
  bureau: varchar("bureau", { length: 32 }).default("boavista"), // boavista ou serasa_premium
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditAnalysis = typeof creditAnalyses.$inferSelect;
export type InsertCreditAnalysis = typeof creditAnalyses.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tipo: mysqlEnum("tipo", ["recarga", "consulta", "estorno"]).notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  descricao: text("descricao").notNull(),
  bureauTipo: varchar("bureauTipo", { length: 32 }), // 'boa_vista' ou 'serasa_premium' (null se for recarga)
  asaasPaymentId: varchar("asaasPaymentId", { length: 128 }), // ID do pagamento no Asaas
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
