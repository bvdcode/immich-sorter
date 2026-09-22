import { createHash } from 'node:crypto';
import type { Asset } from '@/lib/contracts';
import { dateNeedsReview, tryResolveDate } from '@/lib/dates';
import { compareText, distribute, type Schedule, type SchedulePlan } from '@/lib/schedule';
import type { AssetPlan, DateIntent, GroupIntent, GroupPlan, LocationValue } from '@/lib/group-contracts';

type LocationPlan = NonNullable<AssetPlan['location']>;
type DatePlan = NonNullable<AssetPlan['date']>;
type DescriptionPlan = NonNullable<AssetPlan['description']>;

export function sourceRevision(assets: Asset[]): string {
  const material = [...assets].sort((left, right) => compareText(left.id, right.id)).map((asset) => ({
    id: asset.id, localDateTime: asset.localDateTime,
    latitude: asset.exifInfo?.latitude ?? null, longitude: asset.exifInfo?.longitude ?? null,
    dateTimeOriginal: asset.exifInfo?.dateTimeOriginal ?? null, timeZone: asset.exifInfo?.timeZone ?? null,
    description: asset.exifInfo?.description ?? '',
  }));
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

export function currentLocation(asset: Asset): LocationValue | null {
  const latitude = asset.exifInfo?.latitude;
  const longitude = asset.exifInfo?.longitude;
  if (latitude == null || longitude == null) { return null; }
  return { latitude, longitude };
}

export function currentLocal(asset: Asset): string | null {
  return asset.exifInfo?.dateTimeOriginal ? asset.localDateTime.slice(0, 19) : null;
}

function schedulePlan(intent: DateIntent): SchedulePlan {
  switch (intent.strategy) {
    case 'shift': return { strategy: 'shift', anchorId: intent.anchorId, anchorLocal: intent.anchorLocal };
    case 'step': return { strategy: 'step', ordering: intent.ordering, anchorId: intent.anchorId,
      anchorLocal: intent.anchorLocal, stepSeconds: intent.stepSeconds };
    case 'span': return { strategy: 'span', ordering: intent.ordering,
      startLocal: intent.startLocal, endLocal: intent.endLocal };
  }
}

function planLocation(asset: Asset, target: LocationValue, overwrite: boolean): LocationPlan {
  const from = currentLocation(asset);
  if (from === null) { return { kind: 'change', from, to: target }; }
  if (from.latitude === target.latitude && from.longitude === target.longitude) {
    return { kind: 'skip', reason: 'identical', from };
  }
  if (!overwrite) { return { kind: 'skip', reason: 'alreadySet', from }; }
  return { kind: 'change', from, to: target };
}

function planDate(asset: Asset, intent: DateIntent, schedule: Schedule, overwrite: boolean): DatePlan {
  const from = currentLocal(asset);
  if (!overwrite && !dateNeedsReview(asset)) { return { kind: 'skip', reason: 'alreadySet', from }; }
  const local = schedule.assigned.get(asset.id);
  if (local === undefined) { return { kind: 'skip', reason: 'noCurrentDate', from }; }
  const resolution = tryResolveDate(local, intent.timeZone, intent.offset);
  if (!resolution.ok) { return { kind: 'skip', reason: resolution.reason, from }; }
  if (from === local && asset.exifInfo?.timeZone === intent.timeZone) {
    return { kind: 'skip', reason: 'identical', from };
  }
  return { kind: 'change', from, to: local };
}

function planDescription(asset: Asset, target: string, overwrite: boolean): DescriptionPlan {
  const from = asset.exifInfo?.description ?? '';
  if (from === target) { return { kind: 'skip', reason: 'identical', from }; }
  if (from !== '' && !overwrite) { return { kind: 'skip', reason: 'alreadySet', from }; }
  return { kind: 'change', from, to: target };
}

export function hasChanges(plan: AssetPlan): boolean {
  return plan.location?.kind === 'change' || plan.date?.kind === 'change' || plan.description?.kind === 'change';
}

export function buildPlan(assets: Asset[], intent: GroupIntent): GroupPlan {
  const date = intent.date;
  const schedule = date ? distribute(assets.map((asset) => ({ id: asset.id,
    filename: asset.originalFileName, current: currentLocal(asset) })), schedulePlan(date)) : null;
  const plans = assets.map((asset) => {
    const plan: AssetPlan = { id: asset.id, filename: asset.originalFileName };
    if (intent.location) { plan.location = planLocation(asset, intent.location, intent.overwrite.location); }
    if (date && schedule) { plan.date = planDate(asset, date, schedule, intent.overwrite.date); }
    if (intent.description !== undefined) {
      plan.description = planDescription(asset, intent.description, intent.overwrite.description);
    }
    return plan;
  });
  return { revision: sourceRevision(assets), changed: plans.filter(hasChanges).length,
    timeZone: date?.timeZone ?? null, albumIds: intent.albumIds, assets: plans };
}
