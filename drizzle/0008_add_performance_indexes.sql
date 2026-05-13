-- =========================================
-- MIGRATION: Add Performance Indexes
-- Data: 2026-05-13
-- Objetivo: Otimizar queries frequentes
-- =========================================

-- Índices para credit_analyses (consultas de crédito)
CREATE INDEX IF NOT EXISTS idx_credit_analyses_user_id 
ON credit_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_analyses_status 
ON credit_analyses(status);

CREATE INDEX IF NOT EXISTS idx_credit_analyses_created_at 
ON credit_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_analyses_bureau 
ON credit_analyses(bureau);

-- Índice composto para queries comuns (user + status)
CREATE INDEX IF NOT EXISTS idx_credit_analyses_user_status 
ON credit_analyses(user_id, status);

-- Índices para transactions (transações financeiras)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
ON transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON transactions(type);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON transactions(created_at DESC);

-- Índice composto para queries de histórico
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

-- Índices para users (usuários)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_last_signed_in 
ON users(last_signed_in DESC);

-- =========================================
-- TOTAL: 13 índices adicionados
-- Impacto esperado: 
-- - Queries 50-70% mais rápidas
-- - Menos carga no banco
-- - Melhor experiência do usuário
-- =========================================