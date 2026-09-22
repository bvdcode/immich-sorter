import { z } from 'zod';

export const PROCESSED = 'Processed';
export const exifSchema = z.object({
  dateTimeOriginal: z.string().nullish(), timeZone: z.string().nullish(),
  latitude: z.number().nullish(), longitude: z.number().nullish(),
  description: z.string().nullish(), make: z.string().nullish(), model: z.string().nullish(),
});
export const assetSchema = z.object({
  id: z.uuid(), originalFileName: z.string(), type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'OTHER']),
  localDateTime: z.string(), fileCreatedAt: z.string(), updatedAt: z.string(),
  exifInfo: exifSchema.optional(), isTrashed: z.boolean(), isOffline: z.boolean(),
});
export const albumSchema = z.object({ id: z.uuid(), albumName: z.string(), assetCount: z.number(),
  shared: z.boolean().optional() });
export const albumsSchema = z.array(albumSchema);
export const searchSchema = z.object({ assets: z.object({ items: z.array(assetSchema),
  nextPage: z.string().nullable(), nextCursor: z.string().nullish() }) });
export const userSchema = z.object({ id: z.uuid(), name: z.string() });
export const connectionSchema = z.object({ instance: z.string().trim().max(512).url(), key: z.string().trim().min(1).max(1024),
  remember: z.boolean() });
export const sessionSchema = connectionSchema.extend({ userId: z.uuid(), name: z.string(), expires: z.number(), scope: z.string() });
export const presetSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  timeZone: z.string().trim().min(1).max(100) });
export const presetsSchema = z.array(presetSchema).max(500);
export const editSchema = z.object({
  id: z.uuid(), revision: z.string(), albumIds: z.array(z.uuid()).max(100),
  description: z.string().trim().max(20000).optional(),
  location: presetSchema.pick({ latitude: true, longitude: true }).optional(),
  date: z.object({ local: z.string(), timeZone: z.string().trim().min(1), offset: z.number().optional() }).optional(),
});
export const mapMarkerSchema = z.object({ id: z.uuid(), lat: z.number(), lon: z.number(),
  city: z.string().nullable(), state: z.string().nullable(), country: z.string().nullable() });
export const mapMarkersSchema = z.array(mapMarkerSchema);
export const placeSchema = mapMarkerSchema.pick({ city: true, state: true, country: true });
export const placesSchema = z.array(placeSchema);
export const serverConfigSchema = z.object({ mapDarkStyleUrl: z.string(), mapLightStyleUrl: z.string() });
export const bulkResultSchema = z.array(z.object({ id: z.uuid(), success: z.boolean(), error: z.string().optional() }));
export const filtersSchema = z.object({ gps: z.boolean(), date: z.boolean(), album: z.boolean(),
  all: z.boolean(), includeProcessed: z.boolean(), type: z.enum(['ALL', 'IMAGE', 'VIDEO']) });
export type Asset = z.infer<typeof assetSchema>;
export type Album = z.infer<typeof albumSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type Edit = z.infer<typeof editSchema>;
export type Filters = z.infer<typeof filtersSchema>;
export type MapMarker = z.infer<typeof mapMarkerSchema>;
