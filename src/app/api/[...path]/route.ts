import { cookies } from 'next/headers';
import { z } from 'zod';
import { connectionSchema, editSchema, filtersSchema, presetSchema, presetsSchema } from '@/lib/contracts';
import { groupApplySchema, groupIntentSchema, neighbourSourceSchema,
  NEIGHBOUR_MAX, NEIGHBOUR_PAGE } from '@/lib/group-contracts';
import { Immich, albumNameSchema } from '@/server/immich';
import { normalizeInstance, openSession, requireWriteRequest, scopeFor, sealSession } from '@/server/security';
import { Storage } from '@/server/storage';
import { syncSchema, syncStep } from '@/server/sync';
import { revision, saveReview } from '@/server/review';
import { applyGroup, previewGroup } from '@/server/group-apply';
import { neighbours } from '@/server/neighbours';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'immich-sorter-session';
type Context = { params: Promise<{ path: string[] }> };
const json = (value: object, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function dispatch(request: Request, context: Context) {
  const { path } = await context.params;
  const route = path.join('/');
  const url = new URL(request.url);
  const jar = await cookies();
  const writeOrigin = request.method === 'GET' ? null : requireWriteRequest(request);
  if (route === 'connect' && request.method === 'POST') {
    const input = connectionSchema.parse(await request.json());
    const instance = normalizeInstance(input.instance);
    const user = await new Immich(instance, input.key).user();
    const days = input.remember ? 30 : 1;
    const session = { ...input, instance, userId: user.id, name: user.name,
      expires: Date.now() + days * 86400000, scope: scopeFor(instance, user.id, input.key) };
    jar.set(COOKIE, sealSession(session), { httpOnly: true, sameSite: 'strict', path: '/',
      secure: writeOrigin?.protocol === 'https:',
      ...(input.remember ? { maxAge: days * 86400 } : {}) });
    return json({ connected: true });
  }
  if (route === 'disconnect' && request.method === 'POST') { jar.delete(COOKIE); return json({ connected: false }); }
  const token = jar.get(COOKIE)?.value;
  if (!token) { throw new Error('unauthorized'); }
  const session = openSession(token);
  const client = new Immich(session.instance, session.key);
  const db = new Storage(session.scope);
  try {
    if (request.method === 'GET') {
      switch (route) {
        case 'session': return json({ connected: true, instance: session.instance, name: session.name,
          indexed: db.get('indexed') === 'true', count: db.count() });
        case 'albums': return json(await client.albums());
        case 'presets': return json(db.presets());
        case 'history': return json(db.history());
        case 'candidates': {
          const seed = await client.asset(z.uuid().parse(url.searchParams.get('id')));
          const source = neighbourSourceSchema.parse(url.searchParams.get('source'));
          const days = z.coerce.number().int().min(1).max(365).parse(url.searchParams.get('window') ?? '3');
          const count = z.coerce.number().int().min(1).max(NEIGHBOUR_MAX)
            .parse(url.searchParams.get('count') ?? String(NEIGHBOUR_PAGE));
          return json({ items: await neighbours(client, db, source, seed, days, count) });
        }
        case 'map/config': return json({ styleUrl: (await client.serverConfig()).mapDarkStyleUrl });
        case 'map/markers': {
          const after = z.iso.datetime().parse(url.searchParams.get('from'));
          const before = z.iso.datetime().parse(url.searchParams.get('to'));
          return json({ markers: await client.mapMarkers(after, before) });
        }
        case 'map/place': {
          const latitude = z.coerce.number().min(-90).max(90).parse(url.searchParams.get('lat'));
          const longitude = z.coerce.number().min(-180).max(180).parse(url.searchParams.get('lon'));
          const places = await client.reverseGeocode(latitude, longitude);
          return json(places[0] ?? { city: null, state: null, country: null });
        }
        case 'asset': {
          const id = z.uuid().parse(url.searchParams.get('id'));
          const [asset, albums] = await Promise.all([client.asset(id), client.albums(id)]);
          return json({ asset, albums, revision: revision(asset, albums) });
        }
        case 'media': {
          const id = z.uuid().parse(url.searchParams.get('id'));
          const kind = z.enum(['preview', 'video']).parse(url.searchParams.get('kind'));
          let upstreamPath: string;
          switch (kind) {
            case 'preview': upstreamPath = `/assets/${id}/thumbnail?size=preview`; break;
            case 'video': upstreamPath = `/assets/${id}/video/playback`; break;
          }
          const headers = new Headers();
          const range = request.headers.get('range');
          if (range) { headers.set('range', range); }
          const upstream = await client.request(upstreamPath, 'GET', undefined, headers);
          const type = upstream.headers.get('content-type') ?? '';
          if (!/^(image\/(jpeg|png|webp|avif)|video\/)/.test(type)) { throw new Error('invalidMedia'); }
          const outgoing = new Headers({ 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
          for (const name of ['content-length', 'content-range', 'accept-ranges']) {
            const value = upstream.headers.get(name);
            if (value) { outgoing.set(name, value); }
          }
          return new Response(upstream.body, { status: upstream.status, headers: outgoing });
        }
      }
    }
    if (request.method === 'POST') {
      if (Number(request.headers.get('content-length')) > 262144) { return json({ error: 'invalidInput' }, 413); }
      const body: object = z.object({}).passthrough().parse(await request.json());
      switch (route) {
        case 'sync': return json(await syncStep(db, client, syncSchema.parse(body)));
        case 'queue': {
          const input = z.object({ filters: filtersSchema, after: z.string().nullable() }).parse(body);
          if (db.get('indexed') !== 'true') { throw new Error('indexRequired'); }
          return json(db.queue(input.filters, input.after));
        }
        case 'save': return json(await saveReview(client, db, editSchema.parse(body)));
        case 'group/preview': return json(await previewGroup(client, groupIntentSchema.parse(body)));
        case 'group/apply': {
          const input = groupApplySchema.parse(body);
          return json(await applyGroup(client, db, input.intent, input.revision));
        }
        case 'albums': return json(await client.createAlbum(albumNameSchema.parse(body).name));
        case 'presets': {
          const input = z.object({ presets: presetsSchema }).parse(body);
          for (const preset of input.presets) {
            if (!DateTime.now().setZone(preset.timeZone).isValid) { throw new Error('invalidDate'); }
          }
          db.set('presets', input.presets);
          return json(input.presets);
        }
        case 'preset': {
          const preset = presetSchema.parse(body);
          if (!DateTime.now().setZone(preset.timeZone).isValid) { throw new Error('invalidDate'); }
          const presets = db.presets().filter((item) => item.id !== preset.id);
          presets.push(preset);
          db.set('presets', presets);
          return json(presets);
        }
      }
    }
    return json({ error: 'notFound' }, 404);
  } finally { db.close(); }
}

async function handle(request: Request, context: Context) {
  try { return await dispatch(request, context); }
  catch (error) {
    if (error instanceof z.ZodError) { return json({ error: 'invalidInput' }, 400); }
    const message = error instanceof Error ? error.message : 'requestFailed';
    if (message === 'unauthorized') { return json({ error: message }, 401); }
    if (message === 'conflict') { return json({ error: message }, 409); }
    if (message === 'invalidOrigin') { return json({ error: message }, 403); }
    const publicErrors = new Set(['invalidInstance',
      'invalidDate', 'ambiguousDate', 'albumWriteFailed', 'duplicateProcessed', 'verificationFailed',
      'indexRequired', 'anchorMissing', 'noChanges']);
    if (publicErrors.has(message)) { return json({ error: message }, 400); }
    if (/^upstream:\d{3}$/.test(message)) { return json({ error: message }, 502); }
    return json({ error: 'requestFailed' }, 502);
  }
}
export { handle as GET, handle as POST };
