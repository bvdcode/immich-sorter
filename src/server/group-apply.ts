import type { Asset } from '@/lib/contracts';
import { resolveDate } from '@/lib/dates';
import type { GroupIntent, GroupPlan, GroupResult } from '@/lib/group-contracts';
import { buildPlan } from './group-plan';
import { Immich, type AssetFields } from './immich';
import { pooled, READ_CONCURRENCY } from './pool';
import { Storage } from './storage';

type Batch = { ids: string[]; fields: AssetFields };

function readGroup(client: Immich, ids: string[]) {
  return pooled([...new Set(ids)], READ_CONCURRENCY, (id) => client.asset(id));
}

export function expectations(plan: GroupPlan, offset?: number): Map<string, AssetFields> {
  const expected = new Map<string, AssetFields>();
  for (const entry of plan.assets) {
    const fields: AssetFields = {};
    if (entry.location?.kind === 'change') {
      fields.latitude = entry.location.to.latitude;
      fields.longitude = entry.location.to.longitude;
    }
    if (entry.date?.kind === 'change' && plan.timeZone !== null) {
      fields.dateTimeOriginal = resolveDate(entry.date.to, plan.timeZone, offset);
      fields.timeZone = plan.timeZone;
    }
    if (entry.description?.kind === 'change') { fields.description = entry.description.to; }
    if (Object.keys(fields).length > 0) { expected.set(entry.id, fields); }
  }
  return expected;
}

export function batches(expected: Map<string, AssetFields>): Batch[] {
  const grouped = new Map<string, Batch>();
  for (const [id, fields] of expected) {
    const key = JSON.stringify(fields);
    const existing = grouped.get(key);
    if (existing) { existing.ids.push(id); continue; }
    grouped.set(key, { ids: [id], fields });
  }
  return [...grouped.values()];
}

function verified(after: Asset, fields: AssetFields): boolean {
  if (fields.latitude !== undefined
    && (after.exifInfo?.latitude !== fields.latitude || after.exifInfo?.longitude !== fields.longitude)) { return false; }
  if (fields.description !== undefined && after.exifInfo?.description !== fields.description) { return false; }
  if (fields.dateTimeOriginal !== undefined
    && (Date.parse(after.fileCreatedAt) !== Date.parse(fields.dateTimeOriginal)
      || after.exifInfo?.timeZone !== fields.timeZone)) { return false; }
  return true;
}

export async function previewGroup(client: Immich, intent: GroupIntent): Promise<GroupPlan> {
  return buildPlan(await readGroup(client, intent.assetIds), intent);
}

export async function applyGroup(client: Immich, db: Storage, intent: GroupIntent, revision: string): Promise<GroupResult> {
  const before = await readGroup(client, intent.assetIds);
  const plan = buildPlan(before, intent);
  if (plan.revision !== revision) { throw new Error('conflict'); }
  const expected = expectations(plan, intent.date?.offset);
  const albumIds = [...new Set(intent.albumIds)];
  if (expected.size === 0 && albumIds.length === 0) { throw new Error('noChanges'); }
  const ids = before.map((asset) => asset.id);
  const failed = new Map<string, string>();
  for (const asset of before) {
    db.journal(asset.id, JSON.stringify({ status: 'groupStarted', before: asset,
      fields: expected.get(asset.id) ?? null, albumIds }));
  }
  for (const batch of batches(expected)) { await client.updateMany(batch.ids, batch.fields); }
  for (const albumId of albumIds) {
    const accepted = await client.addManyToAlbum(albumId, ids);
    for (const id of ids) {
      if (!accepted.has(id)) { failed.set(id, 'albumWriteFailed'); }
    }
  }
  const after = await readGroup(client, ids);
  for (const asset of after) {
    const fields = expected.get(asset.id);
    if (fields && !verified(asset, fields)) { failed.set(asset.id, 'verificationFailed'); }
  }
  const complete = after.filter((asset) => !failed.has(asset.id)).map((asset) => asset.id);
  if (complete.length > 0) {
    const marker = await client.processedAlbum();
    const accepted = await client.addManyToAlbum(marker.id, complete);
    for (const id of complete) {
      if (!accepted.has(id)) { failed.set(id, 'albumWriteFailed'); }
    }
  }
  const processed = after.filter((asset) => !failed.has(asset.id)).map((asset) => asset.id);
  db.cache(after);
  db.mark(processed, 'processed', true);
  if (albumIds.length > 0) { db.mark(processed, 'no_album', false); }
  for (const asset of after) {
    const error = failed.get(asset.id) ?? null;
    db.journal(asset.id, JSON.stringify({ status: error ? 'groupFailed' : 'groupComplete', after: asset, error }));
  }
  return { processed, failed: [...failed].map(([id, error]) => ({ id, error })) };
}
