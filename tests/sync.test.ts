import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Immich } from '../src/server/immich';
import { Storage } from '../src/server/storage';
import { syncStep } from '../src/server/sync';

it('uses only the account-owned Processed album when building the index', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'immich-cleaner-'));
  process.env.DATA_DIR = directory;
  const db = new Storage('sync');
  const client = new Immich('https://photos.example', 'test');
  const shared = vi.spyOn(client, 'albums');
  const owned = vi.spyOn(client, 'ownedAlbums').mockResolvedValue([]);
  vi.spyOn(client, 'search').mockResolvedValue({ items: [], nextPage: null });
  try {
    const result = await syncStep(db, client, { phase: 'assets', page: 1, markerId: null, reset: true });
    expect(owned).toHaveBeenCalledOnce();
    expect(shared).not.toHaveBeenCalled();
    expect(result.next?.markerId).toBeNull();
  } finally {
    db.close();
    vi.restoreAllMocks();
    delete process.env.DATA_DIR;
    rmSync(directory, { recursive: true });
  }
});
