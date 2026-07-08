import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';
import { prisma } from '@fayapay/db';
import { ForbiddenError, UnauthorizedError } from '@fayapay/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    businessId?: string;
    userId?: string;
    apiKeyId?: string;
    scopes?: string[];
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest) => Promise<void>;
    requireApiKey: (req: FastifyRequest, scope?: string) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; businessId: string };
    user: { sub: string; businessId: string };
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorate('requireUser', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
      req.userId = req.user.sub;
      req.businessId = req.user.businessId;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });

  app.decorate('requireApiKey', async (req: FastifyRequest, scope?: string) => {
    const header = req.headers['x-api-key'];
    if (!header || typeof header !== 'string') throw new UnauthorizedError('Missing API key');
    const [prefix] = header.split('.', 1);
    if (!prefix) throw new UnauthorizedError('Malformed API key');
    const keyHash = createHash('sha256').update(header).digest('hex');
    const apiKey = await prisma.apiKey.findUnique({ where: { keyPrefix: prefix } });
    if (!apiKey || apiKey.revokedAt) throw new UnauthorizedError('Invalid API key');
    if (apiKey.keyHash !== keyHash) throw new UnauthorizedError('Invalid API key');
    if (scope && !apiKey.scopes.includes(scope) && !apiKey.scopes.includes('*')) {
      throw new ForbiddenError(`Scope ${scope} required`);
    }
    req.apiKeyId = apiKey.id;
    req.businessId = apiKey.businessId;
    req.scopes = apiKey.scopes;
    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  });
};

export const authPlugin = fp(plugin, { name: 'auth' });
