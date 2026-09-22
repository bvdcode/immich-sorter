import { DateTime } from 'luxon';
import type { Asset } from '@/lib/contracts';
import { Immich } from './immich';
import { Storage } from './storage';

export type NeighbourSource = 'similar' | 'time' | 'filename';
export const NEIGHBOUR_LIMIT = 24;

function usable(items: Asset[], seed: Asset) {
  return items.filter((item) => item.id !== seed.id && !item.isTrashed && !item.isOffline
    && (item.type === 'IMAGE' || item.type === 'VIDEO')).slice(0, NEIGHBOUR_LIMIT);
}

function byTaken(left: Asset, right: Asset) {
  return Date.parse(left.fileCreatedAt) - Date.parse(right.fileCreatedAt);
}

async function byLooks(client: Immich, seed: Asset) {
  return usable(await client.smartSearch(NEIGHBOUR_LIMIT + 1, { queryAssetId: seed.id }), seed);
}

async function byTime(client: Immich, seed: Asset, windowDays: number) {
  const centre = DateTime.fromISO(seed.fileCreatedAt, { zone: 'UTC' });
  if (!centre.isValid) { return []; }
  const found = await client.search(1, { size: NEIGHBOUR_LIMIT + 1,
    takenAfter: centre.minus({ days: windowDays }).toISO(), takenBefore: centre.plus({ days: windowDays }).toISO() });
  return usable([...found.items].sort(byTaken), seed);
}

export async function neighbours(client: Immich, db: Storage, source: NeighbourSource,
  seed: Asset, windowDays: number): Promise<Asset[]> {
  switch (source) {
    case 'similar': return byLooks(client, seed);
    case 'time': return byTime(client, seed, windowDays);
    case 'filename': return usable(db.neighbours(seed.id, NEIGHBOUR_LIMIT), seed);
  }
}
