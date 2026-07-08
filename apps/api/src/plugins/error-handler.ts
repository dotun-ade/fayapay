import { FayapayError, ProviderError, logger } from '@fayapay/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    return reply.status(422).send({
      error: 'validation_error',
      message: 'Request validation failed',
      details: err.flatten(),
    });
  }
  if (err instanceof FayapayError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId: req.id }, 'fayapay error');
    } else {
      logger.warn({ err, reqId: req.id }, 'fayapay error');
    }
    return reply.status(err.statusCode).send({
      error: err.code,
      message: err.message,
      details: err.details,
      ...(err instanceof ProviderError ? { provider: err.provider } : {}),
    });
  }
  const fErr = err as FastifyError;
  if (fErr.statusCode) {
    return reply.status(fErr.statusCode).send({ error: 'request_error', message: fErr.message });
  }
  logger.error({ err, reqId: req.id }, 'unhandled error');
  return reply.status(500).send({ error: 'internal_error', message: 'Internal server error' });
}
