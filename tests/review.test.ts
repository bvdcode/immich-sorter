import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetSchema, type Album } from '../src/lib/contracts';
import { Immich } from '../src/server/immich';
import { Storage } from '../src/server/storage';
import { revision, saveReview } from '../src/server/review';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'immich-cleaner-')); process.env.DATA_DIR = directory; });
afterEach(() => { vi.restoreAllMocks(); rmSync(directory, { recursive: true }); delete process.env.DATA_DIR; });
const asset = assetSchema.parse({ id: '00000000-0000-4000-8000-000000000001', originalFileName: '20220529_151756.jpg', type: 'IMAGE',
  localDateTime: '2022-05-29T15:17:56Z', fileCreatedAt: '2022-05-29T12:17:56Z', updatedAt: '2022-05-29T12:17:56Z',
  isTrashed: false, isOffline: false, exifInfo: {} });
const album: Album = { id: '00000000-0000-4000-8000-000000000002', albumName: 'Trip', assetCount: 0 };
const marker: Album = { id: '00000000-0000-4000-8000-000000000003', albumName: 'Processed', assetCount: 0 };
it('marks Processed only after metadata and requested albums are verified', async () => {
  const client = new Immich('https://photos.example', 'test'); const db = new Storage('test');
  const membership: Album[] = [];
  let current = asset;
  vi.spyOn(client, 'asset').mockImplementation(async () => current);
  vi.spyOn(client, 'albums').mockImplementation(async () => [...membership]);
  vi.spyOn(client, 'update').mockImplementation(async () => { current = { ...asset, exifInfo: { description: 'A day outside' } }; });
  const add = vi.spyOn(client, 'addToAlbum').mockImplementation(async (id) => {
    if (id === marker.id) { expect(current.exifInfo?.description).toBe('A day outside'); expect(membership).toContain(album); }
    membership.push(id === marker.id ? marker : album);
  });
  vi.spyOn(client, 'processedAlbum').mockResolvedValue(marker);
  try {
    await saveReview(client, db, { id: asset.id, revision: revision(asset, []), albumIds: [album.id], description: 'A day outside' });
    expect(add.mock.calls.map((call) => call[0])).toEqual([album.id, marker.id]); expect(db.history()).toHaveLength(2);
  } finally { db.close(); }
});
it('does not mark Processed after partial write or conflict', async () => {
  const client = new Immich('https://photos.example', 'test'); const db = new Storage('test');
  vi.spyOn(client, 'asset').mockResolvedValue(asset); vi.spyOn(client, 'albums').mockResolvedValue([]);
  const update = vi.spyOn(client, 'update').mockResolvedValue(); const markerCall = vi.spyOn(client, 'processedAlbum');
  try {
    await expect(saveReview(client, db, { id: asset.id, revision: 'stale', albumIds: [] })).rejects.toThrow('conflict');
    expect(update).not.toHaveBeenCalled();
    await expect(saveReview(client, db, { id: asset.id, revision: revision(asset, []), albumIds: [], description: 'Change' })).rejects.toThrow('verificationFailed');
    expect(markerCall).not.toHaveBeenCalled();
  } finally { db.close(); }
});
