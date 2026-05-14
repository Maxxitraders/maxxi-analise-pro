#!/bin/bash
# railway-check-db.sh — Verifica tabelas do banco de dados via Railway
# Usa 'railway run' para executar queries MySQL dentro do ambiente do projeto
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}ℹ  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; }

# Tabelas esperadas no banco (definidas no drizzle/schema.ts)
EXPECTED_TABLES=(
    "users"
    "plans"
    "credit_analyses"
    "transactions"
    "margem_consultations"
)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🔍 Railway DB Check — Maxxi Analise Pro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Pré-requisito ───────────────────────────────────────────────────────
if ! railway status &> /dev/null 2>&1; then
    error "Projeto não linkado. Execute: bash scripts/railway-setup.sh"
    exit 1
fi

# ─── Verificar mysql client ───────────────────────────────────────────────
HAS_MYSQL=false
if command -v mysql &> /dev/null; then
    HAS_MYSQL=true
    success "mysql client disponível"
fi

# ─── Query via railway run ────────────────────────────────────────────────
echo ""
info "Executando verificação via 'railway run'..."
echo ""

# railway run executa o comando dentro do ambiente do serviço (com DATABASE_URL injetado)
# Requer Node.js no ambiente local
CHECK_SCRIPT='
const mysql = require("mysql2/promise");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não encontrado");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  const [tables] = await conn.execute(`
    SELECT table_name, table_rows
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name
  `);

  console.log("\n📋 Tabelas no banco:");
  console.log("─────────────────────────────────────────");

  const expected = ["users", "plans", "credit_analyses", "transactions", "margem_consultations"];
  const found = tables.map(t => t.table_name);

  for (const table of expected) {
    const exists = found.includes(table);
    const info = tables.find(t => t.table_name === table);
    const rows = info?.table_rows ?? 0;
    console.log(`  ${exists ? "✅" : "❌"} ${table.padEnd(30)} ~${rows} linhas`);
  }

  const extras = found.filter(t => !expected.includes(t));
  if (extras.length > 0) {
    console.log("\n  Outras tabelas:");
    extras.forEach(t => console.log(`  ○  ${t}`));
  }

  // Verificar colunas críticas
  console.log("\n📐 Verificando colunas críticas...");
  console.log("─────────────────────────────────────────");

  const criticalChecks = [
    { table: "users", column: "saldo" },
    { table: "users", column: "role" },
    { table: "margem_consultations", column: "matricula" },
    { table: "margem_consultations", column: "cnpj" },
    { table: "transactions", column: "tipo" },
  ];

  for (const { table, column } of criticalChecks) {
    const [cols] = await conn.execute(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
      [table, column]
    );
    const ok = cols.length > 0;
    console.log(`  ${ok ? "✅" : "❌"} ${table}.${column}`);
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
'

# Tenta executar via railway run
if railway run node -e "$CHECK_SCRIPT" 2>/dev/null; then
    echo ""
    success "Verificação concluída!"
else
    warn "Não foi possível executar via 'railway run'."
    echo ""
    echo "Execute manualmente no Railway Dashboard → Database → Query:"
    echo ""
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│  -- Verificar tabelas                                   │"
    echo "│  SELECT table_name, table_rows                          │"
    echo "│  FROM information_schema.tables                         │"
    echo "│  WHERE table_schema = DATABASE()                        │"
    echo "│  ORDER BY table_name;                                   │"
    echo "│                                                         │"
    echo "│  -- Verificar migração aplicada                         │"
    echo "│  DESCRIBE margem_consultations;                         │"
    echo "│                                                         │"
    echo "│  -- Contagem de registros                               │"
    echo "│  SELECT 'users' t, COUNT(*) n FROM users                │"
    echo "│  UNION SELECT 'plans', COUNT(*) FROM plans              │"
    echo "│  UNION SELECT 'analyses', COUNT(*) FROM credit_analyses │"
    echo "│  UNION SELECT 'transactions', COUNT(*) FROM transactions│"
    echo "│  UNION SELECT 'margem', COUNT(*) FROM margem_consultations; │"
    echo "└─────────────────────────────────────────────────────────┘"
fi

# ─── Se tiver mysql client local ─────────────────────────────────────────
if [ "$HAS_MYSQL" = "true" ]; then
    echo ""
    info "mysql client detectado — para conexão direta:"
    echo ""
    echo '  DB_URL=$(railway variables get DATABASE_URL)'
    echo '  mysql "$DB_URL" -e "SHOW TABLES;"'
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
