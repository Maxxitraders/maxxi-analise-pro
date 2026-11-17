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

## Atendimento Humano — Pausar e Reativar a IA (implementado 17/11/2026)

### Comportamento

| Ação | Resultado |
|---|---|
| Eraldo responde qualquer mensagem de um cliente manualmente | Cláudia para de responder àquele contato automaticamente |
| Eraldo envia `#reativar` para o contato | Aguarda 1 minuto, depois Cláudia volta a responder |

### Como funciona internamente

1. O Evolution API sinaliza mensagens enviadas pelo próprio número (`fromMe: true`) → campo `message.event = "outcoming"`
2. O nó **Switch6** detecta e separa mensagens `outcoming` das `incoming`
3. O nó **Palavra para despausar** verifica o conteúdo:
   - Conteúdo == `#reativar` → **Espera para reativar a IA** (1 minuto) → **Reativar IA** (seta `atendimento_ia = "reativada"`)
   - Qualquer outra mensagem → **Pausar IA** (seta `atendimento_ia = "pause"`)
4. O nó **Rota Atendimento** checa `atendimento_ia` em cada mensagem recebida:
   - Valor != `"pause"` → fluxo normal da Cláudia
   - Valor == `"pause"` → fluxo ignorado (IA pausada)

### Correções aplicadas

- **Bug 1 (conexões invertidas):** As saídas do nó `Palavra para despausar` estavam trocadas — `#reativar` levava ao `Pausar IA` e qualquer outra mensagem levava ao `Espera para reativar a IA`. Corrigido (snapshot `mws_7vG1tQ2T5xLK`).
- **Bug 2 (condição errada no Pausar IA):** O `fieldValue` usava expressão condicional que só pausava ao enviar `#assumi`; alterado para valor estático `"pause"` — qualquer mensagem manual agora pausa (snapshot `mws_cZkViTzW4Dyr`).

---

## Observações

- Mensagens do tipo `templateMessage` (ex: cliques em anúncios do Facebook) são **descartadas** pelo `Switch1` — a Cláudia não responde. Isso é comportamento esperado; o cliente precisa mandar uma mensagem de texto depois.
- Erros de transcrição de áudio (`OpenAI` node) em mensagens `fromMe: true` são inofensivos — acontecem quando o usuário responde um cliente por áudio manualmente.
