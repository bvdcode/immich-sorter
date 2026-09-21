import { describe, expect, it } from 'vitest';
import { parseFilename, resolveDate, dateNeedsReview } from '../src/lib/dates';
import { assetSchema } from '../src/lib/contracts';

describe('filename timestamps', () => {
  it('accepts camera prefixes, full timestamps and valid leap days', () => {
    expect(parseFilename('IMG_20240229_123456.jpg')).toBe('2024-02-29T12:34:56');
    expect(parseFilename('20220529_151756.jpg')).toBe('2022-05-29T15:17:56');
    expect(parseFilename('VID_2022-05-29_15-17-56.mp4')).toBe('2022-05-29T15:17:56');
  });
  it('rejects incomplete, malformed and impossible dates', () => {
    for (const name of ['20230229_120000.jpg', '20240101_256000.jpg', 'IMG_20240101.jpg', 'photo.jpg', 'x20240101_120000.jpg']) {
      expect(parseFilename(name)).toBeNull();
    }
  });
});
describe('time zones', () => {
  it('preserves the chosen wall clock while converting to an instant', () => {
    expect(resolveDate('2022-05-29T15:17:56', 'Europe/Moscow')).toBe('2022-05-29T15:17:56.000+03:00');
  });
  it('rejects DST gaps and requires explicit offset during overlap', () => {
    expect(() => resolveDate('2024-03-10T02:30:00', 'America/New_York')).toThrow('invalidDate');
    expect(() => resolveDate('2024-11-03T01:30:00', 'America/New_York')).toThrow('ambiguousDate');
    expect(resolveDate('2024-11-03T01:30:00', 'America/New_York', -300)).toContain('-05:00');
    expect(resolveDate('2024-11-03T01:30:00', 'America/New_York', -240)).toContain('-04:00');
  });
  it('does not flag harmless second-level camera differences', () => {
    const asset = assetSchema.parse({ id: '00000000-0000-4000-8000-000000000001', originalFileName: '20220529_151756.jpg', type: 'IMAGE',
      localDateTime: '2022-05-29T15:17:58Z', fileCreatedAt: '2022-05-29T12:17:58Z', updatedAt: '2022-05-29T12:17:58Z',
      isTrashed: false, isOffline: false, exifInfo: { dateTimeOriginal: '2022-05-29T12:17:58Z' } });
    expect(dateNeedsReview(asset)).toBe(false);
    expect(dateNeedsReview({ ...asset, localDateTime: '2025-01-01T00:00:00Z' })).toBe(true);
  });
});
