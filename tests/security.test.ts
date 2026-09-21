import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeInstance, openSession, requireWriteRequest, sealSession } from '../src/server/security';
import { WRITE_REQUEST_HEADER } from '../src/lib/request-headers';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'immich-cleaner-')); process.env.DATA_DIR = directory; });
afterEach(() => { rmSync(directory, { recursive: true }); delete process.env.DATA_DIR; vi.unstubAllEnvs(); });
it('accepts HTTP(S) instances in production without deployment configuration', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(normalizeInstance('https://photos.example/api/')).toBe('https://photos.example');
  expect(normalizeInstance('http://192.168.1.10:2283')).toBe('http://192.168.1.10:2283');
  expect(normalizeInstance('http://immich:2283')).toBe('http://immich:2283');
});
it('rejects unsafe instance inputs', () => {
  for (const url of ['file:///tmp/test', 'https://user:secret@photos.example', 'https://photos.example?token=x']) {
    expect(() => normalizeInstance(url)).toThrow('invalidInstance');
  }
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
it.each(['http://localhost:3000', 'http://192.168.1.10:8080', 'https://sorter.example'])('accepts browser writes from %s without a configured app URL', (origin) => {
  const request = new Request('http://container:3000/api/save', {
    method: 'POST', headers: { origin, [WRITE_REQUEST_HEADER]: '1', 'sec-fetch-site': 'same-origin' },
  });
  expect(requireWriteRequest(request).origin).toBe(origin);
});
it('supports HTTP browsers without Fetch Metadata', () => {
  const request = new Request('http://container:3000/api/save', {
    method: 'POST', headers: { origin: 'http://192.168.1.10:8080', [WRITE_REQUEST_HEADER]: '1' },
  });
  expect(requireWriteRequest(request).protocol).toBe('http:');
});
it.each(['cross-site', 'same-site', 'none'])('rejects %s writes even with the custom header', (site) => {
  const request = new Request('http://container:3000/api/save', {
    method: 'POST', headers: { origin: 'https://attacker.example', [WRITE_REQUEST_HEADER]: '1', 'sec-fetch-site': site },
  });
  expect(() => requireWriteRequest(request)).toThrow('invalidOrigin');
});
it.each([null, '0'])('rejects missing or incorrect request markers: %s', (marker) => {
  const headers = new Headers({ origin: 'https://sorter.example', 'sec-fetch-site': 'same-origin' });
  if (marker !== null) { headers.set(WRITE_REQUEST_HEADER, marker); }
  expect(() => requireWriteRequest(new Request('http://container/api/save', { headers }))).toThrow('invalidOrigin');
});
it.each([null, 'null', 'not a URL', 'file:///tmp/test', 'https://user:secret@sorter.example', 'https://sorter.example/path'])('rejects invalid browser origins: %s', (origin) => {
  const headers = new Headers({ [WRITE_REQUEST_HEADER]: '1' });
  if (origin !== null) { headers.set('origin', origin); }
  expect(() => requireWriteRequest(new Request('http://container/api/save', { headers }))).toThrow('invalidOrigin');
});
