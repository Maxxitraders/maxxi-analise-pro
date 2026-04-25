/**
 * Middleware de Autenticação Obrigatória
 * PREVINE: Bypass de autenticação
 */
import { TRPCError } from '@trpc/server';

export function requireAuth(ctx: any) {
  if (!ctx.user || !ctx.user.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária. Faça login para continuar.'
    });
  }
  return ctx.user;
}

export function requireRole(ctx: any, allowedRoles: ('user' | 'admin')[]) {
  const user = requireAuth(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.'
    });
  }
  return user;
}

export function requireAdmin(ctx: any) {
  return requireRole(ctx, ['admin']);
}
