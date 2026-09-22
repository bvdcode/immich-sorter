import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetSchema, type Album, type Asset } from '../src/lib/contracts';
import type { GroupIntent } from '../src/lib/group-contracts';
import { Immich, type AssetFields } from '../src/server/immich';
import { Storage } from '../src/server/storage';
import { applyGroup } from '../src/server/group-apply';
import { sourceRevision } from '../src/server/group-plan';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'immich-sorter-')); process.env.DATA_DIR = directory; });
afterEach(() => { vi.restoreAllMocks(); rmSync(directory, { recursive: true }); delete process.env.DATA_DIR; });

const marker: Album = { id: '00000000-0000-4000-8000-0000000000ff', albumName: 'Processed', assetCount: 0 };
const trip: Album = { id: '00000000-0000-4000-8000-0000000000aa', albumName: 'Crimea', assetCount: 0 };
const crimea = { latitude: 44.495861, longitude: 34.166111 };
function id(index: number) { return `00000000-0000-4000-8000-00000000000${index}`; }
function asset(index: number, exif: object = {}, localDateTime = '2007-08-14T10:00:00'): Asset {
  return assetSchema.parse({ id: id(index), originalFileName: `IMG_000${index}.jpg`, type: 'IMAGE',
    localDateTime, fileCreatedAt: localDateTime, updatedAt: '2024-01-01T00:00:00Z',
    isTrashed: false, isOffline: false, exifInfo: exif });
}
function intent(overrides: Partial<GroupIntent>): GroupIntent {
  return { assetIds: [], albumIds: [], overwrite: { location: false, date: false, description: false }, ...overrides };
}
function written(current: Asset, fields: AssetFields): Asset {
  const exifInfo = { ...current.exifInfo };
  if (fields.latitude !== undefined) { exifInfo.latitude = fields.latitude; exifInfo.longitude = fields.longitude; }
  if (fields.description !== undefined) { exifInfo.description = fields.description; }
  if (fields.dateTimeOriginal !== undefined) {
    exifInfo.dateTimeOriginal = fields.dateTimeOriginal;
    exifInfo.timeZone = fields.timeZone;
    return { ...current, exifInfo, fileCreatedAt: fields.dateTimeOriginal };
  }
  return { ...current, exifInfo };
}
function library(assets: Asset[]) {
  const client = new Immich('https://photos.example', 'test');
  const state = new Map(assets.map((entry) => [entry.id, entry]));
  vi.spyOn(client, 'asset').mockImplementation(async (assetId) => {
    const found = state.get(assetId);
    if (!found) { throw new Error('upstream:404'); }
    return found;
  });
  const update = vi.spyOn(client, 'updateMany').mockImplementation(async (ids, fields) => {
    for (const assetId of ids) {
      const current = state.get(assetId);
      if (current) { state.set(assetId, written(current, fields)); }
    }
  });
  const album = vi.spyOn(client, 'addManyToAlbum').mockImplementation(async (_, ids) => new Set(ids));
  vi.spyOn(client, 'processedAlbum').mockResolvedValue(marker);
  return { client, state, update, album };
}

it('gives one place to a whole group in a single write and leaves located frames alone', async () => {
  const group = [asset(1), asset(2), asset(3, { latitude: 1, longitude: 2 })];
  const { client, state, update } = library(group);
  const db = new Storage('scope');
  try {
    const result = await applyGroup(client, db,
      intent({ assetIds: [id(1), id(2), id(3), id(1)], location: crimea }), sourceRevision(group));
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith([id(1), id(2)], crimea);
    expect(state.get(id(3))?.exifInfo?.latitude).toBe(1);
    expect(result.processed).toEqual([id(1), id(2), id(3)]);
    expect(result.failed).toEqual([]);
  } finally { db.close(); }
});

it('writes one request per distinct timestamp when a group is spread over time', async () => {
  const group = [asset(1), asset(2), asset(3)];
  const { client, state, update } = library(group);
  const db = new Storage('scope');
  try {
    await applyGroup(client, db, intent({ assetIds: group.map((entry) => entry.id), location: crimea,
      date: { strategy: 'step', timeZone: 'Europe/Moscow', ordering: 'byFilename',
        anchorId: id(1), anchorLocal: '2019-06-01T12:00:00', stepSeconds: 60 } }), sourceRevision(group));
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls.map((call) => call[0])).toEqual([[id(1)], [id(2)], [id(3)]]);
    expect(state.get(id(1))?.exifInfo?.dateTimeOriginal).toBe('2019-06-01T12:00:00.000+03:00');
    expect(state.get(id(3))?.exifInfo?.dateTimeOriginal).toBe('2019-06-01T12:02:00.000+03:00');
    expect(state.get(id(2))?.exifInfo?.latitude).toBe(crimea.latitude);
  } finally { db.close(); }
});

it('keeps a frame out of Processed when the read-back does not match', async () => {
  const group = [asset(1), asset(2)];
  const { client, update } = library(group);
  update.mockImplementation(async () => undefined);
  const db = new Storage('scope');
  try {
    const result = await applyGroup(client, db,
      intent({ assetIds: group.map((entry) => entry.id), location: crimea }), sourceRevision(group));
    expect(result.processed).toEqual([]);
    expect(result.failed).toEqual([
      { id: id(1), error: 'verificationFailed' }, { id: id(2), error: 'verificationFailed' }]);
  } finally { db.close(); }
});

it('marks only the frames that survived the write', async () => {
  const group = [asset(1), asset(2)];
  const { client, state, update } = library(group);
  update.mockImplementation(async (ids, fields) => {
    for (const assetId of ids) {
      const current = state.get(assetId);
      if (current && assetId !== id(2)) { state.set(assetId, written(current, fields)); }
    }
  });
  const db = new Storage('scope');
  try {
    const result = await applyGroup(client, db,
      intent({ assetIds: group.map((entry) => entry.id), location: crimea }), sourceRevision(group));
    expect(result.processed).toEqual([id(1)]);
    expect(result.failed).toEqual([{ id: id(2), error: 'verificationFailed' }]);
  } finally { db.close(); }
});

it('refuses to write when the group changed in Immich since the preview', async () => {
  const { client, update } = library([asset(1)]);
  const db = new Storage('scope');
  try {
    await expect(applyGroup(client, db, intent({ assetIds: [id(1)], location: crimea }), 'stale'))
      .rejects.toThrow('conflict');
    expect(update).not.toHaveBeenCalled();
  } finally { db.close(); }
});

it('refuses a group that would change nothing at all', async () => {
  const group = [asset(1, crimea)];
  const { client, update } = library(group);
  const db = new Storage('scope');
  try {
    await expect(applyGroup(client, db, intent({ assetIds: [id(1)], location: crimea }), sourceRevision(group)))
      .rejects.toThrow('noChanges');
    expect(update).not.toHaveBeenCalled();
  } finally { db.close(); }
});

it('adds an album to every frame and reports the ones Immich refused', async () => {
  const group = [asset(1), asset(2)];
  const { client, album } = library(group);
  album.mockImplementation(async (albumId, ids) => {
    if (albumId === trip.id) { return new Set([id(1)]); }
    return new Set(ids);
  });
  const db = new Storage('scope');
  try {
    const result = await applyGroup(client, db,
      intent({ assetIds: group.map((entry) => entry.id), albumIds: [trip.id] }), sourceRevision(group));
    expect(result.processed).toEqual([id(1)]);
    expect(result.failed).toEqual([{ id: id(2), error: 'albumWriteFailed' }]);
  } finally { db.close(); }
});
