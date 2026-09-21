import { createHash } from 'node:crypto';
import type { Asset, Album, Edit } from '@/lib/contracts';
import { PROCESSED } from '@/lib/contracts';
import { resolveDate } from '@/lib/dates';
import { Immich } from './immich';
import { Storage } from './storage';

export function revision(asset: Asset, albums: Album[]) {
  return createHash('sha256').update(JSON.stringify({ asset, albums: albums.map((a) => a.id).sort() })).digest('hex');
}
export async function saveReview(client: Immich, db: Storage, edit: Edit) {
  const [before, membership] = await Promise.all([client.asset(edit.id), client.albums(edit.id)]);
  if (revision(before, membership) !== edit.revision) { throw new Error('conflict'); }
  const fields: { description?: string; latitude?: number; longitude?: number; dateTimeOriginal?: string; timeZone?: string } = {};
  if (edit.description !== undefined) { fields.description = edit.description; }
  if (edit.location) { fields.latitude = edit.location.latitude; fields.longitude = edit.location.longitude; }
  if (edit.date) { fields.dateTimeOriginal = resolveDate(edit.date.local, edit.date.timeZone, edit.date.offset); fields.timeZone = edit.date.timeZone; }
  db.journal(edit.id, JSON.stringify({ status: 'started', before, albumIds: membership.map((a) => a.id), edit }));
  if (Object.keys(fields).length) { await client.update(edit.id, fields); }
  for (const albumId of new Set(edit.albumIds)) {
    if (!membership.some((a) => a.id === albumId)) { await client.addToAlbum(albumId, edit.id); }
  }
  const [after, albums] = await Promise.all([client.asset(edit.id), client.albums(edit.id)]);
  if (fields.description !== undefined && after.exifInfo?.description !== fields.description) { throw new Error('verificationFailed'); }
  if (fields.latitude !== undefined && (after.exifInfo?.latitude !== fields.latitude || after.exifInfo?.longitude !== fields.longitude)) { throw new Error('verificationFailed'); }
  if (fields.dateTimeOriginal && (Date.parse(after.fileCreatedAt) !== Date.parse(fields.dateTimeOriginal) || after.exifInfo?.timeZone !== fields.timeZone)) { throw new Error('verificationFailed'); }
  if (edit.albumIds.some((id) => !albums.some((a) => a.id === id))) { throw new Error('verificationFailed'); }
  const marker = await client.processedAlbum();
  await client.addToAlbum(marker.id, edit.id);
  const finalAlbums = await client.albums(edit.id);
  if (!finalAlbums.some((a) => a.id === marker.id)) { throw new Error('verificationFailed'); }
  db.cache([after]);
  db.mark([edit.id], 'processed', true);
  db.mark([edit.id], 'no_album', !finalAlbums.some((a) => a.albumName !== PROCESSED));
  db.journal(edit.id, JSON.stringify({ status: 'complete', before, after, albumIdsBefore: membership.map((a) => a.id), albumIdsAfter: finalAlbums.map((a) => a.id) }));
  return { asset: after, albums: finalAlbums, revision: revision(after, finalAlbums) };
}
