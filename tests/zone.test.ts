import { expect, it } from 'vitest';
import { assetSchema, type Asset } from '../src/lib/contracts';
import { fixedZone, zoneOf } from '../src/lib/dates';

function asset(localDateTime: string, fileCreatedAt: string, timeZone?: string): Asset {
  return assetSchema.parse({ id: '00000000-0000-4000-8000-000000000001', originalFileName: 'a.jpg',
    type: 'IMAGE', localDateTime, fileCreatedAt, updatedAt: fileCreatedAt,
    isTrashed: false, isOffline: false, exifInfo: { timeZone, dateTimeOriginal: fileCreatedAt } });
}

it('prefers the time zone the photo carries', () => {
  expect(zoneOf(asset('2019-04-20T23:04:19.000Z', '2019-04-20T20:04:19.000Z', 'Europe/Moscow'))).toBe('Europe/Moscow');
});

it('works out the offset a photo was stored with when it names no zone', () => {
  expect(zoneOf(asset('2019-04-20T23:04:19.000Z', '2019-04-20T20:04:19.000Z'))).toBe('UTC+3');
  expect(zoneOf(asset('2019-12-01T01:43:05.000Z', '2019-12-01T09:43:05.000Z'))).toBe('UTC-8');
});

it('gives up rather than invent an impossible offset', () => {
  expect(zoneOf(asset('2019-04-20T23:04:19.000Z', '2019-04-18T20:04:19.000Z'))).toBeNull();
});

it('writes half-hour offsets in full', () => {
  expect(fixedZone(330)).toBe('UTC+5:30');
  expect(fixedZone(-210)).toBe('UTC-3:30');
  expect(fixedZone(0)).toBe('UTC+0');
});
