import { z } from 'zod';
import { albumsSchema, albumSchema, assetSchema, bulkResultSchema, mapMarkersSchema, placesSchema,
  searchSchema, serverConfigSchema, userSchema, PROCESSED } from '@/lib/contracts';
import { normalizeInstance } from './security';

export type AssetFields = { description?: string; latitude?: number; longitude?: number;
  dateTimeOriginal?: string; timeZone?: string };

export class Immich {
  constructor(private readonly instance: string, private readonly key: string) {}
  async request(path: string, method = 'GET', body?: object, headers?: HeadersInit) {
    const base = normalizeInstance(this.instance);
    const requestHeaders = new Headers(headers);
    requestHeaders.set('x-api-key', this.key);
    if (body) { requestHeaders.set('Content-Type', 'application/json'); }
    const response = await fetch(`${base}/api${path}`, {
      method, headers: requestHeaders, body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) { throw new Error(`upstream:${response.status}`); }
    return response;
  }
  async user() { return userSchema.parse(await (await this.request('/users/me')).json()); }
  async albums(assetId?: string) {
    return albumsSchema.parse(await (await this.request(`/albums${assetId ? `?assetId=${assetId}` : ''}`)).json());
  }
  async asset(id: string) { return assetSchema.parse(await (await this.request(`/assets/${id}`)).json()); }
  async ownedAlbums() {
    return albumsSchema.parse(await (await this.request('/albums?isOwned=true')).json());
  }
  async search(page: number, extra: object = {}) {
    return searchSchema.parse(await (await this.request('/search/metadata', 'POST',
      { page, size: 250, withExif: true, withDeleted: false, withStacked: true, ...extra })).json()).assets;
  }
  async smartSearch(size: number, extra: object) {
    return searchSchema.parse(await (await this.request('/search/smart', 'POST',
      { size, withExif: true, withDeleted: false, ...extra })).json()).assets.items;
  }
  async createAlbum(name: string) {
    return albumSchema.parse(await (await this.request('/albums', 'POST', { albumName: name })).json());
  }
  async addManyToAlbum(albumId: string, assetIds: string[]) {
    const ids = [...new Set(assetIds)];
    const result = bulkResultSchema.parse(await (await this.request(`/albums/${albumId}/assets`, 'PUT', { ids })).json());
    return new Set(result.filter((entry) => entry.success || entry.error === 'duplicate').map((entry) => entry.id));
  }
  async addToAlbum(albumId: string, assetId: string) {
    const accepted = await this.addManyToAlbum(albumId, [assetId]);
    if (!accepted.has(assetId)) { throw new Error('albumWriteFailed'); }
  }
  async processedAlbum() {
    const owned = await this.ownedAlbums();
    const matches = owned.filter((a) => a.albumName === PROCESSED);
    if (matches.length > 1) { throw new Error('duplicateProcessed'); }
    if (matches[0]) { return matches[0]; }
    return this.createAlbum(PROCESSED);
  }
  async mapMarkers(after: string, before: string) {
    const query = new URLSearchParams({ fileCreatedAfter: after, fileCreatedBefore: before });
    return mapMarkersSchema.parse(await (await this.request(`/map/markers?${query}`)).json());
  }
  async reverseGeocode(latitude: number, longitude: number) {
    const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
    return placesSchema.parse(await (await this.request(`/map/reverse-geocode?${query}`)).json());
  }
  async serverConfig() {
    return serverConfigSchema.parse(await (await this.request('/server/config')).json());
  }
  async updateMany(ids: string[], fields: AssetFields) {
    await this.request('/assets', 'PUT', { ids, ...fields });
  }
  async update(id: string, fields: AssetFields) { await this.updateMany([id], fields); }
}
export const albumNameSchema = z.object({ name: z.string().trim().min(1).max(200).refine((v) => v !== PROCESSED) });
