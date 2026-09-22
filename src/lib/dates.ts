import { DateTime } from 'luxon';
import type { Asset } from './contracts';

export const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
export type DateResolution = { ok: true; iso: string } | { ok: false; reason: 'invalidDate' | 'ambiguousDate' };

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

export function tryResolveDate(local: string, zone: string, offset?: number): DateResolution {
  const date = DateTime.fromISO(local, { zone });
  if (!date.isValid || date.toFormat(LOCAL_FORMAT) !== local) { return { ok: false, reason: 'invalidDate' }; }
  const choices = date.getPossibleOffsets();
  if (choices.length > 1 && offset === undefined) { return { ok: false, reason: 'ambiguousDate' }; }
  const selected = offset === undefined ? date : choices.find((item) => item.offset === offset);
  const iso = selected?.toISO();
  if (!iso) { return { ok: false, reason: 'invalidDate' }; }
  return { ok: true, iso };
}

export function resolveDate(local: string, zone: string, offset?: number): string {
  const resolution = tryResolveDate(local, zone, offset);
  if (!resolution.ok) { throw new Error(resolution.reason); }
  return resolution.iso;
}
