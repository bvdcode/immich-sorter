import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionSchema, type Session } from '@/lib/contracts';
import { dataDirectory } from './storage';

export function normalizeInstance(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('invalidInstance');
  }
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  const instance = url.toString().replace(/\/$/, '');
  const allowed = (process.env.IMMICH_ALLOWED_ORIGINS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(url.origin)) { throw new Error('instanceNotAllowed'); }
  if (process.env.NODE_ENV === 'production' && !allowed.length && process.env.LOCAL_MODE !== 'true') {
    throw new Error('configureOrigins');
  }
  return instance;
}

function encryptionKey() {
  const path = join(dataDirectory(), 'session.key');
  if (!existsSync(path)) {
    try { writeFileSync(path, randomBytes(32), { mode: 0o600, flag: 'wx' }); }
    catch (error) { if (!existsSync(path)) { throw error; } }
  }
  const key = readFileSync(path);
  if (key.length !== 32) { throw new Error('sessionKeyInvalid'); }
  return key;
}
export function sealSession(session: Session) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
}
export function openSession(token: string): Session {
  try {
    const data = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const json = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
    const session = sessionSchema.parse(JSON.parse(json));
    if (session.expires < Date.now()) { throw new Error('expired'); }
    normalizeInstance(session.instance);
    return session;
  } catch { throw new Error('unauthorized'); }
}
export function scopeFor(instance: string, user: string, key: string) {
  return createHash('sha256').update(`${instance}\n${user}\n${key}`).digest('hex');
}
export function requireOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : new URL(request.url).origin;
  if (origin !== expected) { throw new Error('invalidOrigin'); }
}
