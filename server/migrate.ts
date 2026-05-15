/**
 * Script de migração - cria tabelas no banco de dados se não existirem
 * Executado automaticamente no deploy
 */
import mysql from "mysql2/promise";

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[Migrate] DATABASE_URL não configurada");
    return;
  }

  console.log("[Migrate] Conectando ao banco de dados...");
  
  let conn;
  try {
    conn = await mysql.createConnection(url);
    console.log("[Migrate] Conectado! Criando tabelas...");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`openId\` varchar(64) NOT NULL,
        \`name\` text,
        \`email\` varchar(320),
        \`passwordHash\` varchar(255),
        \`loginMethod\` varchar(64),
        \`resetToken\` varchar(128),
        \`resetTokenExpiry\` timestamp NULL,
        \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
        \`stripeCustomerId\` varchar(128),
        \`stripeSubscriptionId\` varchar(128),
        \`asaasCustomerId\` varchar(128),
        \`asaasSubscriptionId\` varchar(128),
        \`planId\` varchar(32) DEFAULT 'none',
        \`subscriptionStatus\` varchar(32) DEFAULT 'none',
        \`consultasUsedThisMonth\` int DEFAULT 0,
        \`consultasResetAt\` timestamp NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`users_openId_unique\` (\`openId\`)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`plans\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`slug\` varchar(32) NOT NULL,
        \`name\` varchar(64) NOT NULL,
        \`description\` text,
        \`monthlyPrice\` int NOT NULL,
        \`consultasLimit\` int NOT NULL,
        \`features\` json NOT NULL,
        \`popular\` boolean DEFAULT false,
        \`active\` boolean NOT NULL DEFAULT true,
        \`sortOrder\` int DEFAULT 0,
        \`stripePriceId\` varchar(128),
        \`stripeProductId\` varchar(128),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`plans_slug_unique\` (\`slug\`)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`credit_analyses\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`cnpj\` varchar(18) NOT NULL,
        \`documentType\` varchar(4) DEFAULT 'cnpj',
        \`companyName\` varchar(255),
        \`situacao\` varchar(32),
        \`dataAbertura\` varchar(16),
        \`capitalSocial\` decimal(15,2),
        \`naturezaJuridica\` varchar(128),
        \`score\` int,
        \`hasProtestos\` boolean DEFAULT false,
        \`valorDivida\` decimal(15,2),
        \`quantidadeRestricoes\` int DEFAULT 0,
        \`status\` enum('APROVADO','REPROVADO','ANALISE_MANUAL') NOT NULL,
        \`motivo\` text,
        \`alertSent\` boolean DEFAULT false,
        \`pdfUrl\` text,
        \`nomeFantasia\` varchar(255),
        \`atividadePrincipal\` text,
        \`endereco\` text,
        \`bairro\` varchar(128),
        \`cidade\` varchar(128),
        \`uf\` varchar(2),
        \`cep\` varchar(12),
        \`telefone\` varchar(32),
        \`email\` varchar(320),
        \`porte\` varchar(64),
        \`socios\` text,
        \`scoreMensagem\` text,
        \`protestosJson\` text,
        \`pendenciasJson\` text,
        \`chequesSemFundo\` int DEFAULT 0,
        \`chequesSustados\` int DEFAULT 0,
        \`cadastralDataSource\` varchar(32),
        \`creditDataSource\` varchar(32),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (\`id\`)
      )
    `);

    // ── Migrações incrementais (adicionar colunas novas se não existirem) ──
    const addColumnIfNotExists = async (table: string, column: string, definition: string) => {
      const [rows] = await conn!.execute(
        `SELECT COUNT(*) as count FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      const count = (rows as any)[0].count;
      if (count === 0) {
        console.log(`[Migrate] Adicionando coluna ${column} em ${table}...`);
        await conn!.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
      }
    };

    await addColumnIfNotExists("users", "cpfCnpj", "`cpfCnpj` varchar(32)");
    await addColumnIfNotExists("users", "phone", "`phone` varchar(32)");
    await addColumnIfNotExists("users", "saldo", "`saldo` decimal(10,2) NOT NULL DEFAULT '0.00'");
    await addColumnIfNotExists("credit_analyses", "bureau", "`bureau` varchar(32) DEFAULT 'boavista'");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`tipo\` enum('recarga','consulta','estorno') NOT NULL,
        \`valor\` decimal(10,2) NOT NULL,
        \`descricao\` text NOT NULL,
        \`bureauTipo\` varchar(32),
        \`asaasPaymentId\` varchar(128),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (\`id\`)
      )
    `);


    // Inserir planos padrão se não existirem
    await conn.execute(`
      INSERT IGNORE INTO \`plans\` (\`slug\`, \`name\`, \`description\`, \`monthlyPrice\`, \`consultasLimit\`, \`features\`, \`popular\`, \`active\`, \`sortOrder\`) VALUES
      ('basico', 'Básico', 'Ideal para pequenas empresas', 4900, 50, '["50 consultas/mês","CPF e CNPJ","Score Boa Vista SCPC","Relatório PDF","Suporte por email"]', false, true, 1),
      ('pro', 'Pro', 'Para empresas em crescimento', 9900, 200, '["200 consultas/mês","CPF e CNPJ","Score Boa Vista SCPC","Relatório PDF","Alertas de alto risco","Suporte prioritário"]', true, true, 2),
      ('enterprise', 'Enterprise', 'Para grandes operações', 19900, -1, '["Consultas ilimitadas","CPF e CNPJ","Score Boa Vista SCPC","Relatório PDF","Alertas de alto risco","API dedicada","Suporte 24/7"]', false, true, 3)
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`margem_consultations\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`cpf\` varchar(14) NOT NULL,
        \`matricula\` varchar(100),
        \`cnpj\` varchar(14),
        \`nomeCompleto\` varchar(255),
        \`dataNascimento\` varchar(16),
        \`margemDisponivel\` decimal(10,2),
        \`margemUtilizada\` decimal(10,2),
        \`margemTotal\` decimal(10,2),
        \`margemCartaoDisponivel\` decimal(10,2),
        \`margemCartaoUtilizada\` decimal(10,2),
        \`orgao\` varchar(255),
        \`competencia\` varchar(16),
        \`status\` varchar(32) NOT NULL,
        \`rawResponse\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (\`id\`)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`serasa_consultations\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`cpf\` varchar(11) NOT NULL,
        \`score\` int,
        \`scoreCategoria\` varchar(50),
        \`nome\` varchar(255),
        \`dataNascimento\` varchar(16),
        \`totalPendencias\` decimal(10,2),
        \`qtdPendencias\` int DEFAULT 0,
        \`totalProtestos\` decimal(10,2),
        \`qtdProtestos\` int DEFAULT 0,
        \`totalChequesSemFundo\` decimal(10,2),
        \`qtdChequesSemFundo\` int DEFAULT 0,
        \`totalChequesSustados\` decimal(10,2),
        \`qtdChequesSustados\` int DEFAULT 0,
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`rawResponse\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (\`id\`)
      )
    `);

    console.log("[Migrate] ✅ Tabelas criadas com sucesso!");
  } catch (error) {
    console.error("[Migrate] Erro:", error);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
