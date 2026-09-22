import { expect, it } from 'vitest';
import { assetSchema, type Asset } from '../src/lib/contracts';
import type { GroupIntent } from '../src/lib/group-contracts';
import { buildPlan, sourceRevision } from '../src/server/group-plan';

const moscow = { latitude: 55.751244, longitude: 37.618423 };
function id(index: number) { return `00000000-0000-4000-8000-00000000000${index}`; }
function asset(index: number, exif: object = {}, localDateTime = '2007-08-14T10:00:00'): Asset {
  return assetSchema.parse({ id: id(index), originalFileName: `IMG_000${index}.jpg`, type: 'IMAGE',
    localDateTime, fileCreatedAt: localDateTime, updatedAt: '2024-01-01T00:00:00Z',
    isTrashed: false, isOffline: false, exifInfo: exif });
}
function intent(overrides: Partial<GroupIntent>): GroupIntent {
  return { assetIds: [], albumIds: [], overwrite: { location: false, date: false, description: false }, ...overrides };
}

it('fills a missing location and leaves photos that already have one alone', () => {
  const plan = buildPlan([asset(1), asset(2, { latitude: 1, longitude: 2 })], intent({ location: moscow }));
  expect(plan.assets[0].location).toEqual({ kind: 'change', from: null, to: moscow });
  expect(plan.assets[1].location).toEqual({ kind: 'skip', reason: 'alreadySet', from: { latitude: 1, longitude: 2 } });
  expect(plan.changed).toBe(1);
});

it('replaces an existing location only when overwriting is asked for', () => {
  const group = [asset(1, { latitude: 1, longitude: 2 })];
  const plan = buildPlan(group, intent({ location: moscow, overwrite: { location: true, date: false, description: false } }));
  expect(plan.assets[0].location).toEqual({ kind: 'change', from: { latitude: 1, longitude: 2 }, to: moscow });
});

it('reports a location that is already exactly the target as identical', () => {
  const plan = buildPlan([asset(1, moscow)], intent({ location: moscow }));
  expect(plan.assets[0].location).toEqual({ kind: 'skip', reason: 'identical', from: moscow });
  expect(plan.changed).toBe(0);
});

it('spreads a corrected time over the frames that need review and keeps the good one', () => {
  const group = [
    asset(1, {}, '2007-08-14T10:00:00'),
    asset(2, {}, '2007-08-14T10:05:00'),
    asset(3, { dateTimeOriginal: '2019-06-01T12:00:00Z' }, '2019-06-01T12:00:00'),
  ];
  const plan = buildPlan(group, intent({ date: { strategy: 'step', timeZone: 'Europe/Moscow',
    ordering: 'byFilename', anchorId: id(1), anchorLocal: '2019-06-01T11:00:00', stepSeconds: 60 } }));
  expect(plan.assets[0].date).toEqual({ kind: 'change', from: null, to: '2019-06-01T11:00:00' });
  expect(plan.assets[1].date).toEqual({ kind: 'change', from: null, to: '2019-06-01T11:01:00' });
  expect(plan.assets[2].date).toEqual({ kind: 'skip', reason: 'alreadySet', from: '2019-06-01T12:00:00' });
});

it('keeps the intervals of the whole group when shifting from a known-good frame', () => {
  const group = [
    asset(1, { dateTimeOriginal: '2007-08-14T10:00:00Z' }, '2007-08-14T10:00:00'),
    asset(2, { dateTimeOriginal: '2007-08-14T10:07:00Z' }, '2007-08-14T10:07:00'),
  ];
  const plan = buildPlan(group, intent({
    date: { strategy: 'shift', timeZone: 'Europe/Moscow', anchorId: id(1), anchorLocal: '2019-06-01T12:00:00' },
    overwrite: { location: false, date: true, description: false } }));
  expect(plan.assets[0].date).toEqual({ kind: 'change', from: '2007-08-14T10:00:00', to: '2019-06-01T12:00:00' });
  expect(plan.assets[1].date).toEqual({ kind: 'change', from: '2007-08-14T10:07:00', to: '2019-06-01T12:07:00' });
});

it('reports a frame that cannot be placed instead of inventing a time for it', () => {
  const group = [asset(1, { dateTimeOriginal: '2007-08-14T10:00:00Z' }), asset(2)];
  const plan = buildPlan(group, intent({
    date: { strategy: 'shift', timeZone: 'Europe/Moscow', anchorId: id(1), anchorLocal: '2019-06-01T12:00:00' },
    overwrite: { location: false, date: true, description: false } }));
  expect(plan.assets[1].date).toEqual({ kind: 'skip', reason: 'noCurrentDate', from: null });
});

it('reports a local time that daylight saving skipped', () => {
  const plan = buildPlan([asset(1)], intent({ date: { strategy: 'step', timeZone: 'Europe/Berlin',
    ordering: 'byFilename', anchorId: id(1), anchorLocal: '2019-03-31T02:30:00', stepSeconds: 60 } }));
  expect(plan.assets[0].date).toEqual({ kind: 'skip', reason: 'invalidDate', from: null });
});

it('reports a local time that happens twice unless an offset settles it', () => {
  const repeated = { strategy: 'step', timeZone: 'Europe/Berlin', ordering: 'byFilename',
    anchorId: id(1), anchorLocal: '2019-10-27T02:30:00', stepSeconds: 60 } as const;
  expect(buildPlan([asset(1)], intent({ date: repeated })).assets[0].date)
    .toEqual({ kind: 'skip', reason: 'ambiguousDate', from: null });
  expect(buildPlan([asset(1)], intent({ date: { ...repeated, offset: 120 } })).assets[0].date)
    .toEqual({ kind: 'change', from: null, to: '2019-10-27T02:30:00' });
});

it('writes a description only where there is none, unless overwriting', () => {
  const group = [asset(1), asset(2, { description: 'Old note' })];
  const careful = buildPlan(group, intent({ description: 'Sea' }));
  expect(careful.assets[0].description).toEqual({ kind: 'change', from: '', to: 'Sea' });
  expect(careful.assets[1].description).toEqual({ kind: 'skip', reason: 'alreadySet', from: 'Old note' });
  const forced = buildPlan(group, intent({ description: 'Sea',
    overwrite: { location: false, date: false, description: true } }));
  expect(forced.assets[1].description).toEqual({ kind: 'change', from: 'Old note', to: 'Sea' });
});

it('hashes the same group to the same revision whatever order it arrives in', () => {
  const group = [asset(1), asset(2, { latitude: 1, longitude: 2 })];
  expect(sourceRevision(group)).toBe(sourceRevision([...group].reverse()));
  expect(sourceRevision(group)).not.toBe(sourceRevision([asset(1), asset(2, { latitude: 9, longitude: 9 })]));
});
