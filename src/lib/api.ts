import { z } from 'zod';
import { albumSchema, assetSchema, filtersSchema, mapMarkersSchema } from './contracts';
import { WRITE_REQUEST_HEADER } from './request-headers';

export const sessionInfoSchema = z.object({ connected: z.boolean(), instance: z.string(), name: z.string(), indexed: z.boolean(), count: z.number() });
export const detailSchema = z.object({ asset: assetSchema, albums: z.array(albumSchema), revision: z.string() });
export const queueItemSchema = z.object({ asset: assetSchema, noAlbum: z.boolean(), processed: z.boolean(), cursor: z.string() });
export const queueSchema = z.object({ total: z.number(), items: z.array(queueItemSchema) });
export const syncInputSchema = z.object({ phase: z.enum(['assets', 'unalbumed', 'processed']), page: z.number(), markerId: z.string().nullable(), reset: z.boolean() });
export const syncResultSchema = z.object({ done: z.boolean(), count: z.number(), next: syncInputSchema.nullable() });
export const candidatesSchema = z.object({ items: z.array(assetSchema) });
export const mapConfigSchema = z.object({ styleUrl: z.url() });
export const markersSchema = z.object({ markers: mapMarkersSchema });
export type Detail = z.infer<typeof detailSchema>;
export type QueueItem = z.infer<typeof queueItemSchema>;
export type SyncInput = z.infer<typeof syncInputSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export const defaultFilters = filtersSchema.parse({ gps: true, date: true, album: true, all: false, includeProcessed: false, type: 'ALL' });

export async function api<S extends z.ZodType>(path: string, schema: S, body?: object): Promise<z.output<S>> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json', [WRITE_REQUEST_HEADER]: '1' } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (!response.ok) {
    const result = z.object({ error: z.string() }).safeParse(await response.json());
    throw new Error(result.success ? result.data.error : 'requestFailed');
  }
  return schema.parse(await response.json());
}
