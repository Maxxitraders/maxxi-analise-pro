# Sentry — Monitoramento e Debug

## Configuração Atual

### Backend (Node.js)
- Error tracking
- Performance monitoring (10% sample)
- Profiling de CPU/memória (10% sample) via `@sentry/profiling-node`
- HTTP requests tracking
- Source maps (esbuild `--sourcemap`)
- Filtro automático de dados sensíveis

### Frontend (React)
- Error tracking
- Browser tracing com INP (Interaction to Next Paint)
- Session replay: 10% sessões normais, 100% sessões com erro
- Network recording (bodies + headers)
- HTTP client tracking (status 4xx–5xx)
- Filtro automático de dados sensíveis + breadcrumbs

## Testando Sentry (Desenvolvimento)

### Backend:
```bash
# Gera erro e envia para Sentry
curl http://localhost:3000/api/debug/test-sentry-error

# Cria um span de 1s e retorna o spanId
curl http://localhost:3000/api/debug/test-sentry-transaction

# Registra breadcrumbs de teste
curl http://localhost:3000/api/debug/test-sentry-breadcrumbs
```

### Frontend (console do navegador):
```javascript
throw new Error("Teste Sentry Frontend");
```

## Variáveis de Ambiente (Railway)

```env
SENTRY_DSN=https://...@sentry.io/...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

## Dados Sensíveis Filtrados

Chaves removidas automaticamente em request headers, body e breadcrumbs:
`password`, `passwordhash`, `resettoken`, `token`, `apikey`, `authorization`,
`secret`, `cpf`, `cnpj`, `creditcard`, `cvv`, `pan`, `senha`

## Sampling Rates

| Recurso                        | Taxa |
|-------------------------------|------|
| Backend traces                | 10%  |
| Backend profiling             | 10%  |
| Frontend traces               | 10%  |
| Session replay (normal)       | 10%  |
| Session replay (com erro)     | 100% |

## Elementos Mascarados no Replay

- Inputs de formulário: sempre mascarados (`maskAllInputs: true`)
- Elementos `.sensitive` ou `[data-sensitive]`: texto mascarado
- Elementos `.private` ou `[data-private]`: elemento bloqueado (não gravado)

## Próximos Passos

1. **Conectar GitHub**: Sentry → Settings → Integrations → GitHub
   - Vincula commits que causaram erros aos issues do Sentry
2. **Configurar Alertas**: Sentry → Alerts → New Alert
   - Email/Slack/Discord para erros críticos
3. **Source Maps Upload** (opcional): configurar Sentry CLI no CI/CD para
   upload automático dos source maps gerados pelo build
