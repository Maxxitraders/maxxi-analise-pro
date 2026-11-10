# Cláudia — Troubleshooting & Correções

## Infraestrutura

| Componente | Valor |
|---|---|
| n8n workflow | Agente Multi atendimento 10.2 ( Correção remoj ID) — ID `8nWsgbzhQu3HksRP` |
| Evolution instância | `Maxxi` — número `5511982106568` |
| Webhook URL | `https://toothlessportuguesemanowar-n8n.cloudfy.live/webhook/januzzi` |
| Evolution Manager | `https://toothlessportuguesemanowar-evolution.cloudfy.live/manager` |

---

## Problema: Cláudia para de responder (webhook morto)

**Sintomas:** clientes mandam mensagens, zero execuções aparecem no n8n.

**Causa:** o Evolution API entra em estado inconsistente e para de disparar eventos para o n8n, mesmo com a instância conectada (`state: open`).

**Solução — restart via MCP (preferencial):**

Pedir ao Claude para executar:
```
service_request → evolution-api → POST /instance/restart/Maxxi
```

Isso retorna `{ "instance": { "instanceName": "Maxxi", "state": "open" } }` em caso de sucesso. As execuções voltam em ~30 segundos.

**Solução — restart manual (alternativa):**
1. Cloudfy dashboard → Evolution API → Admin → clicar no ícone ↗ do Manager
2. Clicar no card **Maxxi**
3. Clicar em **RESTART**

---

## Correção aplicada em 11/10/2026 — Fallback quando Parser Chain falha

**Problema:** quando o nó `Parser Chain` falhava, a Cláudia ficava em silêncio (sem resposta ao cliente).

**Fix:** adicionado nó `Enviar Fallback` (id `fallback-parser-001`) conectado à saída FALSE do `If4`. Quando o Parser Chain não consegue gerar resposta estruturada, o fallback envia `$('Nome agent Claudia').item.json['Resposta']` diretamente via Evolution API.

---

## Observações

- Mensagens do tipo `templateMessage` (ex: cliques em anúncios do Facebook) são **descartadas** pelo `Switch1` — a Cláudia não responde. Isso é comportamento esperado; o cliente precisa mandar uma mensagem de texto depois.
- Erros de transcrição de áudio (`OpenAI` node) em mensagens `fromMe: true` são inofensivos — acontecem quando o usuário responde um cliente por áudio manualmente.
