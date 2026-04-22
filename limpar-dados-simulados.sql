-- Script para remover registros com dados simulados do banco de produção
-- Execute com cuidado! Faz backup antes.
-- Registros simulados têm: companyName como nomes fictícios E score = 0

DELETE FROM credit_analyses 
WHERE (
  companyName LIKE '%João da Silva%' 
  OR companyName LIKE '%Tech Solutions Brasil%'
  OR companyName LIKE '%Empresa Simulada%'
)
AND (cadastralDataSource = 'simulado' OR creditDataSource = 'simulado' OR score = 0);

-- Alternativa mais segura: apenas marcar como simulado (não apagar)
-- UPDATE credit_analyses SET motivo = CONCAT('[SIMULADO] ', motivo)
-- WHERE cadastralDataSource = 'simulado' OR creditDataSource = 'simulado';
