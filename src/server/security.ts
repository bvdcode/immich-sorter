import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionSchema, type Session } from '@/lib/contracts';
import { WRITE_REQUEST_HEADER } from '../lib/request-headers';
import { dataDirectory } from './storage';

export function normalizeInstance(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('invalidInstance');
  }
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  const instance = url.toString().replace(/\/$/, '');
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
export function requireWriteRequest(request: Request): URL {
  const site = request.headers.get('sec-fetch-site');
  if (request.headers.get(WRITE_REQUEST_HEADER) !== '1' || (site !== null && site !== 'same-origin')) {
    throw new Error('invalidOrigin');
  }
  const origin = request.headers.get('origin');
  if (!origin || !URL.canParse(origin)) { throw new Error('invalidOrigin'); }
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('invalidOrigin');
  }
  return url;
}
