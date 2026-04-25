/**
 * Rate Limiting
 * PREVINE: Brute force, DoS, abuso
 */
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Muitas requisições. Aguarde 15 minutos e tente novamente.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos.',
    code: 'LOGIN_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Muitas tentativas de registro. Aguarde 1 hora.',
    code: 'REGISTER_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const consultaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Aguarde 1 minuto antes de fazer mais consultas.',
    code: 'CONSULTA_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const recargaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    error: 'Aguarde 5 minutos antes de fazer outra recarga.',
    code: 'RECARGA_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Muitas tentativas. Aguarde 1 hora.',
    code: 'FORGOT_PASSWORD_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
