import crypto from 'crypto';

const validTokens = new Set<string>();

export function createAdminToken(): string {
  const token = crypto.randomUUID();
  validTokens.add(token);
  return token;
}

export function isValidAdminToken(token: string): boolean {
  return validTokens.has(token);
}
