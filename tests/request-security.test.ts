import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { api } from '../src/lib/api';
import { WRITE_REQUEST_HEADER } from '../src/lib/request-headers';
import { Immich } from '../src/server/immich';
import { POST } from '../src/app/api/[...path]/route';

const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar }));
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'immich-sorter-'));
  vi.stubEnv('DATA_DIR', directory);
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(directory, { recursive: true });
});

it('includes the browser request marker on API writes', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connected: true }));
  vi.stubGlobal('fetch', fetchMock);
  await api('connect', z.object({ connected: z.boolean() }), { instance: 'http://immich:2283', key: 'test' });
  expect(fetchMock).toHaveBeenCalledWith('/api/connect', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', [WRITE_REQUEST_HEADER]: '1' },
  }));
});

it.each([
  { origin: 'http://localhost:8080', secure: false },
  { origin: 'http://192.168.1.10:8080', secure: false },
  { origin: 'https://sorter.example', secure: true },
])('connects behind an HTTP proxy for $origin with correct cookie security', async ({ origin, secure }) => {
  vi.spyOn(Immich.prototype, 'user').mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', name: 'Test' });
  const response = await POST(new Request('http://container:3000/api/connect', {
    method: 'POST',
    headers: { origin, [WRITE_REQUEST_HEADER]: '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ instance: 'http://immich:2283', key: 'test-key', remember: true }),
  }), { params: Promise.resolve({ path: ['connect'] }) });
  expect(response.status).toBe(200);
  expect(jar.set).toHaveBeenCalledWith('immich-sorter-session', expect.any(String), expect.objectContaining({
    httpOnly: true, sameSite: 'strict', secure, maxAge: 30 * 86400,
  }));
  expect(response.headers.has('access-control-allow-origin')).toBe(false);
});

it('rejects unmarked requests before contacting Immich or setting cookies', async () => {
  const user = vi.spyOn(Immich.prototype, 'user');
  const response = await POST(new Request('http://container:3000/api/connect', {
    method: 'POST', headers: { origin: 'https://attacker.example', 'Content-Type': 'text/plain' },
    body: JSON.stringify({ instance: 'http://immich:2283', key: 'test-key', remember: true }),
  }), { params: Promise.resolve({ path: ['connect'] }) });
  expect(response.status).toBe(403);
  expect(user).not.toHaveBeenCalled();
  expect(jar.set).not.toHaveBeenCalled();
  expect(response.headers.has('access-control-allow-origin')).toBe(false);
});
