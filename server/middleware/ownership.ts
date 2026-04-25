/**
 * Validação de Propriedade de Recursos
 * PREVINE: IDOR (Insecure Direct Object Reference)
 */
import { TRPCError } from '@trpc/server';

export async function requireOwnership<T extends { userId: number }>(
  resource: T | null | undefined,
  requestingUserId: number,
  resourceName: string = 'Recurso'
): Promise<T> {

  if (!resource) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `${resourceName} não encontrado`
    });
  }

  if (resource.userId !== requestingUserId) {
    console.warn(
      `[SECURITY ALERT] Tentativa de acesso não autorizado`,
      {
        resourceType: resourceName,
        requestingUserId,
        resourceOwnerId: resource.userId,
        timestamp: new Date().toISOString()
      }
    );

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }

  return resource;
}
