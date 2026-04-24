/**
 * Sanitização de Dados Sensíveis
 * PREVINE: Information Disclosure
 */

export function sanitizeUser(user: any) {
  if (!user) return null;

  const {
    passwordHash,
    resetToken,
    resetTokenExpiry,
    asaasCustomerId,
    ...safe
  } = user;

  return safe;
}

export function sanitizeError(
  error: any,
  isProduction: boolean = process.env.NODE_ENV === 'production'
) {
  if (isProduction) {
    return {
      message: 'Erro interno do servidor. Tente novamente.',
      code: error.code || 'INTERNAL_ERROR'
    };
  }

  return {
    message: error.message || 'Erro desconhecido',
    code: error.code || 'INTERNAL_ERROR',
  };
}

export function maskCPF(cpf: string): string {
  if (!cpf || cpf.length !== 11) return '***.***.***-**';
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
}

export function maskCNPJ(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return '**.***.***/**01-**';
  return `${cnpj.slice(0, 2)}.***.***/**${cnpj.slice(-5)}`;
}

export function maskCPFCNPJ(cpfCnpj: string): string {
  const cleaned = cpfCnpj.replace(/\D/g, '');
  if (cleaned.length === 11) return maskCPF(cleaned);
  if (cleaned.length === 14) return maskCNPJ(cleaned);
  return '***';
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  const [domainName, domainExt] = domain.split('.');
  const maskedLocal = local[0] + '***' + (local[local.length - 1] || '');
  const maskedDomain = domainName[0] + '***';
  return `${maskedLocal}@${maskedDomain}.${domainExt}`;
}
