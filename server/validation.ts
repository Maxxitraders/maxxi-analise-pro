/**
 * Schemas de Validação com Zod
 * PREVINE: SQL Injection, XSS, DoS
 */
import { z } from 'zod';

export const cpfCnpjSchema = z.string()
  .min(11, 'CPF/CNPJ inválido')
  .max(14, 'CPF/CNPJ inválido')
  .regex(/^\d+$/, 'CPF/CNPJ deve conter apenas números')
  .refine(
    (val) => val.length === 11 || val.length === 14,
    'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'
  )
  .transform(val => val.replace(/\D/g, ''));

export const emailSchema = z.string()
  .email('Email inválido')
  .min(5, 'Email muito curto')
  .max(255, 'Email muito longo')
  .toLowerCase()
  .trim();

export const senhaSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número');

export const nomeSchema = z.string()
  .min(2, 'Nome muito curto')
  .max(100, 'Nome muito longo')
  .trim()
  .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras');

export const valorMonetarioSchema = z.number()
  .min(0.01, 'Valor mínimo: R$ 0,01')
  .max(100000, 'Valor máximo: R$ 100.000,00')
  .refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    'Valor deve ter no máximo 2 casas decimais'
  );

export const telefoneSchema = z.string()
  .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
  .transform(val => val.replace(/\D/g, ''));

export const cepSchema = z.string()
  .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')
  .transform(val => val.replace(/\D/g, ''));

export const idSchema = z.number()
  .int('ID deve ser um número inteiro')
  .positive('ID deve ser positivo');

export const bureauTipoSchema = z.enum(
  ['boa_vista', 'serasa_premium'] as const,
  { message: 'Tipo de bureau inválido. Use: boa_vista ou serasa_premium' }
);

export const metodoPagamentoSchema = z.enum(
  ['PIX', 'CREDIT_CARD', 'BOLETO'] as const,
  { message: 'Método de pagamento inválido. Use: PIX, CREDIT_CARD ou BOLETO' }
);

export const textoLivreSchema = (maxLength: number = 1000) =>
  z.string()
    .max(maxLength, `Texto deve ter no máximo ${maxLength} caracteres`)
    .trim();

export const descricaoCurtaSchema = textoLivreSchema(200);
export const descricaoLongaSchema = textoLivreSchema(2000);

export const urlSchema = z.string()
  .url('URL inválida')
  .max(2048, 'URL muito longa')
  .optional()
  .or(z.literal(''));

export const dataISOSchema = z.string()
  .datetime('Data inválida. Use formato ISO 8601');

export const booleanSchema = z.boolean();
export const roleSchema = z.enum(['user', 'admin']);

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const adicionarSaldoInputSchema = z.object({
  valor: valorMonetarioSchema
    .pipe(z.number().min(5, 'Valor mínimo para recarga: R$ 5,00').max(1000, 'Valor máximo para recarga: R$ 1.000,00')),
  metodoPagamento: metodoPagamentoSchema,
});

export const consultarCreditoInputSchema = z.object({
  cpfCnpj: cpfCnpjSchema,
  bureauTipo: bureauTipoSchema,
});

export const registerInputSchema = z.object({
  name: nomeSchema,
  email: emailSchema,
  password: senhaSchema,
  cpfCnpj: cpfCnpjSchema.optional(),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});
