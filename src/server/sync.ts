import { z } from 'zod';
import { PROCESSED } from '@/lib/contracts';
import { Immich } from './immich';
import { Storage } from './storage';

export const syncSchema = z.object({ phase: z.enum(['assets', 'unalbumed', 'processed']), page: z.number().int().min(1),
  markerId: z.uuid().nullable(), reset: z.boolean() });
export async function syncStep(db: Storage, client: Immich, input: z.infer<typeof syncSchema>) {
  let markerId = input.markerId;
  if (input.reset) {
    const albums = await client.ownedAlbums();
    const markers = albums.filter((a) => a.albumName === PROCESSED);
    if (markers.length > 1) { throw new Error('duplicateProcessed'); }
    markerId = markers[0]?.id ?? null;
    db.reset();
  }
  let extra = {};
  switch (input.phase) {
    case 'assets': break;
    case 'unalbumed': extra = { isNotInAlbum: true }; break;
    case 'processed':
      if (!markerId) { db.set('indexed', true); return { done: true, count: db.count(), next: null }; }
      extra = { albumIds: [markerId] }; break;
  }
  const results = await client.search(input.page, extra);
  switch (input.phase) {
    case 'assets': db.cache(results.items); break;
    case 'unalbumed': db.mark(results.items.map((a) => a.id), 'no_album', true); break;
    case 'processed': db.mark(results.items.map((a) => a.id), 'processed', true); break;
  }
  if (results.nextPage) {
    const nextPage = Number(results.nextPage);
    if (!Number.isInteger(nextPage) || nextPage <= input.page) { throw new Error('paginationFailed'); }
    return { done: false, count: db.count(), next: { ...input, page: nextPage, reset: false, markerId } };
  }
  switch (input.phase) {
    case 'assets': return { done: false, count: db.count(), next: { phase: 'unalbumed', page: 1, reset: false, markerId } };
    case 'unalbumed': return { done: false, count: db.count(), next: { phase: 'processed', page: 1, reset: false, markerId } };
    case 'processed': db.set('indexed', true); return { done: true, count: db.count(), next: null };
  }
}
