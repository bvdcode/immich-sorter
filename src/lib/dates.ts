import { DateTime } from 'luxon';
import type { Asset } from './contracts';

export function parseFilename(name: string): string | null {
  const match = /(?:^|[_-])((?:19|20)\d{2})[-_]?([01]\d)[-_]?([0-3]\d)[_T-]([0-2]\d)[-_:]?([0-5]\d)[-_:]?([0-5]\d)(?=[_.-]|$)/.exec(name);
  if (!match) { return null; }
  const [, year, month, day, hour, minute, second] = match;
  const local = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  return DateTime.fromISO(local, { zone: 'UTC' }).isValid ? local : null;
}

export function dateNeedsReview(asset: Asset): boolean {
  if (!asset.exifInfo?.dateTimeOriginal) { return true; }
  const parsed = parseFilename(asset.originalFileName);
  if (!parsed) { return false; }
  const current = DateTime.fromISO(asset.localDateTime, { zone: 'UTC' });
  return !current.isValid || Math.abs(current.toMillis() - DateTime.fromISO(parsed, { zone: 'UTC' }).toMillis()) > 86400000;
}

export function resolveDate(local: string, zone: string, offset?: number): string {
  const date = DateTime.fromISO(local, { zone });
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new Error('invalidDate');
  }
  const choices = date.getPossibleOffsets();
  if (choices.length > 1 && offset === undefined) { throw new Error('ambiguousDate'); }
  const selected = offset === undefined ? date : choices.find((item) => item.offset === offset);
  if (!selected) { throw new Error('invalidDate'); }
  const iso = selected.toISO();
  if (!iso) { throw new Error('invalidDate'); }
  return iso;
}
