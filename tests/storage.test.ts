import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../src/server/storage';
import { assetSchema } from '../src/lib/contracts';
import { defaultFilters } from '../src/lib/api';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'immich-cleaner-')); process.env.DATA_DIR = directory; });
afterEach(() => { rmSync(directory, { recursive: true }); delete process.env.DATA_DIR; });
const asset = assetSchema.parse({ id: '00000000-0000-4000-8000-000000000001', originalFileName: '20220529_151756.jpg', type: 'IMAGE',
  localDateTime: '2022-05-29T15:17:56Z', fileCreatedAt: '2022-05-29T12:17:56Z', updatedAt: '2022-05-29T12:17:56Z',
  isTrashed: false, isOffline: false, exifInfo: { latitude: 0, longitude: 0, dateTimeOriginal: '2022-05-29T12:17:56Z' } });
it('uses OR filters, valid zero coordinates, Processed exclusion and stable cursor', () => {
  const db = new Storage('first');
  try {
    db.cache([asset, { ...asset, id: '00000000-0000-4000-8000-000000000002', exifInfo: {} }]);
    expect(db.queue(defaultFilters, null).total).toBe(1);
    db.mark([asset.id], 'no_album', true);
    expect(db.queue(defaultFilters, null).total).toBe(2);
    const cursor = db.queue(defaultFilters, null).items[0].cursor;
    expect(db.queue(defaultFilters, cursor).items).toHaveLength(1);
    db.mark([asset.id], 'processed', true);
    expect(db.queue(defaultFilters, null).total).toBe(1);
    expect(db.queue({ ...defaultFilters, includeProcessed: true }, null).total).toBe(2);
  } finally { db.close(); }
});
it('isolates connections and preserves presets when rebuilding media cache', () => {
  const first = new Storage('first'); const second = new Storage('second');
  try {
    first.cache([asset]); first.set('presets', []); first.set('indexed', true);
    expect(second.count()).toBe(0); first.reset();
    expect(first.count()).toBe(0); expect(first.get('indexed')).toBe('false'); expect(first.presets()).toEqual([]);
  } finally { first.close(); second.close(); }
});
