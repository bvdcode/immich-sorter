import { DateTime } from 'luxon';
import type { Asset } from '@/lib/contracts';
import type { NeighbourSource } from '@/lib/group-contracts';
import { Immich } from './immich';
import { Storage } from './storage';

function usable(items: Asset[], seed: Asset, count: number) {
  return items.filter((item) => item.id !== seed.id && !item.isTrashed && !item.isOffline
    && (item.type === 'IMAGE' || item.type === 'VIDEO')).slice(0, count);
}

function byTaken(left: Asset, right: Asset) {
  return Date.parse(left.fileCreatedAt) - Date.parse(right.fileCreatedAt);
}

async function byLooks(client: Immich, seed: Asset, count: number) {
  return usable(await client.smartSearch(count + 1, { queryAssetId: seed.id }), seed, count);
}

async function byTime(client: Immich, seed: Asset, windowDays: number, count: number) {
  const centre = DateTime.fromISO(seed.fileCreatedAt, { zone: 'UTC' });
  if (!centre.isValid) { return []; }
  const found = await client.search(1, { size: count + 1,
    takenAfter: centre.minus({ days: windowDays }).toISO(), takenBefore: centre.plus({ days: windowDays }).toISO() });
  return usable([...found.items].sort(byTaken), seed, count);
}

export async function neighbours(client: Immich, db: Storage, source: NeighbourSource,
  seed: Asset, windowDays: number, count: number): Promise<Asset[]> {
  switch (source) {
    case 'similar': return byLooks(client, seed, count);
    case 'time': return byTime(client, seed, windowDays, count);
    case 'filename': return usable(db.neighbours(seed.id, Math.ceil(count / 2)), seed, count);
  }
}
