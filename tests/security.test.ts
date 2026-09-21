import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeInstance, openSession, requireOrigin, sealSession } from '../src/server/security';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'immich-cleaner-')); process.env.DATA_DIR = directory; });
afterEach(() => { rmSync(directory, { recursive: true }); delete process.env.DATA_DIR; delete process.env.IMMICH_ALLOWED_ORIGINS; });
it('rejects unsafe instance inputs and honors the deployment allowlist', () => {
  expect(normalizeInstance('https://photos.example/api/')).toBe('https://photos.example');
  for (const url of ['file:///tmp/test', 'https://user:secret@photos.example', 'https://photos.example?token=x']) {
    expect(() => normalizeInstance(url)).toThrow('invalidInstance');
  }
  process.env.IMMICH_ALLOWED_ORIGINS = 'https://photos.example';
  expect(() => normalizeInstance('https://elsewhere.example')).toThrow('instanceNotAllowed');
});
it('encrypts session credentials and rejects tampering and expiration', () => {
  const session = { instance: 'https://photos.example', key: 'test-secret', remember: true,
    userId: '00000000-0000-4000-8000-000000000001', name: 'Test', scope: 'scope', expires: Date.now() + 10000 };
  const token = sealSession(session);
  expect(token).not.toContain('test-secret'); expect(openSession(token)).toEqual(session);
  const bytes = Buffer.from(token, 'base64url'); bytes[20] ^= 1;
  expect(() => openSession(bytes.toString('base64url'))).toThrow('unauthorized');
  expect(() => openSession(sealSession({ ...session, expires: 0 }))).toThrow('unauthorized');
});
it('requires a same-origin write', () => {
  expect(() => requireOrigin(new Request('http://localhost/api/save', { headers: { origin: 'https://attacker.example' } }))).toThrow('invalidOrigin');
  expect(() => requireOrigin(new Request('http://localhost/api/save', { headers: { origin: 'http://localhost' } }))).not.toThrow();
});
