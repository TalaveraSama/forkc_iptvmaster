import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import {
  AuthService,
  createPasswordRecord,
  normalizeUsername,
  type AuthRepository,
  type NewAdminSession,
  type NewAdministrator,
  type NewApiToken,
  type StoredAdminSession,
  type StoredAdministrator,
  type StoredApiToken,
} from './auth.js';

class TokenAuthRepository implements AuthRepository {
  administrator: StoredAdministrator | null = null;
  sessions = new Map<string, StoredAdminSession>();
  tokens = new Map<string, StoredApiToken>();

  async countAdministrators(): Promise<number> {
    return this.administrator ? 1 : 0;
  }

  async createAdministrator(
    administrator: NewAdministrator,
  ): Promise<StoredAdministrator | null> {
    if (this.administrator) return null;
    this.administrator = {
      id: '00000000-0000-4000-8000-0000000009t0',
      ...administrator,
    };
    return this.administrator;
  }

  async findAdministrator(
    normalizedUsername: string,
  ): Promise<StoredAdministrator | null> {
    return this.administrator?.normalizedUsername === normalizedUsername
      ? this.administrator
      : null;
  }

  async createSession(session: NewAdminSession): Promise<void> {
    if (!this.administrator) throw new Error('Missing administrator');
    this.sessions.set(session.tokenHash, {
      ...session,
      username: this.administrator.username,
    });
  }

  async findSession(tokenHash: string): Promise<StoredAdminSession | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0;
  }

  async createApiToken(token: NewApiToken): Promise<void> {
    this.tokens.set(token.tokenHash, {
      adminId: token.adminId,
      username: this.administrator?.username ?? 'admin',
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
    });
  }

  async findApiToken(tokenHash: string): Promise<StoredApiToken | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async deleteApiToken(tokenHash: string): Promise<void> {
    this.tokens.delete(tokenHash);
  }

  async cleanupExpiredApiTokens(): Promise<number> {
    return 0;
  }

  async healthCheck(): Promise<void> {}
}

async function seedAdministrator(
  repository: TokenAuthRepository,
): Promise<void> {
  const record = await createPasswordRecord('correct-horse-battery');
  await repository.createAdministrator({
    username: 'admin',
    normalizedUsername: normalizeUsername('admin'),
    ...record,
  });
}

const applications: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe('mobile bearer-token service', () => {
  it('issues, authenticates, and revokes tokens; hashes at rest', async () => {
    const repository = new TokenAuthRepository();
    await seedAdministrator(repository);
    const service = new AuthService(repository);
    expect(service.supportsApiTokens()).toBe(true);

    const token = await service.issueApiToken(
      repository.administrator!.id,
      60_000,
      'mobile',
    );
    expect(typeof token).toBe('string');
    // The raw token is never persisted; only its hash is stored.
    expect(repository.tokens.has(token)).toBe(false);

    const session = await service.authenticateApiToken(token);
    expect(session).toMatchObject({ username: 'admin' });

    await service.revokeApiToken(token);
    expect(await service.authenticateApiToken(token)).toBeNull();
    expect(await service.authenticateApiToken('not-a-real-token')).toBeNull();
  });

  it('rejects token issuance when the repository does not support it', async () => {
    const repository: AuthRepository = {
      countAdministrators: async () => 1,
      createAdministrator: async () => null,
      findAdministrator: async () => null,
      createSession: async () => {},
      findSession: async () => null,
      deleteSession: async () => {},
      cleanupExpiredSessions: async () => 0,
      healthCheck: async () => {},
    };
    const service = new AuthService(repository);
    expect(service.supportsApiTokens()).toBe(false);
    await expect(service.issueApiToken('id', 1000)).rejects.toThrow();
    expect(await service.authenticateApiToken('x')).toBeNull();
    await expect(service.revokeApiToken('x')).resolves.toBeUndefined();
  });
});

describe('mobile bearer-token API', () => {
  async function tokenApp(): Promise<{
    app: Awaited<ReturnType<typeof buildApp>>;
    repository: TokenAuthRepository;
  }> {
    const repository = new TokenAuthRepository();
    await seedAdministrator(repository);
    const app = await buildApp({
      authRepository: repository,
      apiTokenTtlMs: 60 * 60 * 1_000,
    });
    applications.push(app);
    return { app, repository };
  }

  it('exchanges credentials for a token and authorizes protected routes', async () => {
    const { app } = await tokenApp();

    const issued = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token',
      headers: { origin: 'https://localhost' },
      payload: { username: 'admin', password: 'correct-horse-battery' },
    });
    expect(issued.statusCode).toBe(200);
    const body = issued.json() as { token: string; username: string };
    expect(body.username).toBe('admin');
    expect(typeof body.token).toBe('string');
    // No cookies are set for a token sign-in.
    expect(issued.headers['set-cookie']).toBeUndefined();
    // The Capacitor origin is allowed to read the cross-origin response.
    expect(issued.headers['access-control-allow-origin']).toBe(
      'https://localhost',
    );

    const status = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/status',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(status.json()).toMatchObject({
      enabled: true,
      authenticated: true,
      username: 'admin',
    });

    // A protected route is reachable with the bearer token and, because a
    // bearer token is not ambient, needs no CSRF header.
    const protectedGet = await app.inject({
      method: 'GET',
      url: '/api/v1/sources',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(protectedGet.statusCode).not.toBe(401);
  });

  it('rejects an invalid token and a revoked token', async () => {
    const { app } = await tokenApp();

    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/sources',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(missing.statusCode).toBe(401);

    const issued = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token',
      payload: { username: 'admin', password: 'correct-horse-battery' },
    });
    const { token } = issued.json() as { token: string };

    const revoked = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/token',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoked.statusCode).toBe(204);

    const afterRevoke = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(afterRevoke.json()).toMatchObject({ authenticated: false });
  });

  it('rejects bad credentials when minting a token', async () => {
    const { app } = await tokenApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token',
      payload: { username: 'admin', password: 'wrong-password-value' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('does not send CORS headers for an unknown origin', async () => {
    const { app } = await tokenApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token',
      headers: { origin: 'https://evil.example' },
      payload: { username: 'admin', password: 'correct-horse-battery' },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the CORS preflight for the app origin without requiring auth', async () => {
    const { app } = await tokenApp();
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/sources',
      headers: {
        origin: 'https://localhost',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(preflight.statusCode).toBeLessThan(300);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'https://localhost',
    );
    expect(preflight.headers['access-control-allow-headers']).toContain(
      'authorization',
    );
  });
});
