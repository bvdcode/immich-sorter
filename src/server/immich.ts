import { z } from 'zod';
import { albumsSchema, albumSchema, assetSchema, bulkResultSchema, searchSchema, userSchema, PROCESSED } from '@/lib/contracts';
import { normalizeInstance } from './security';

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
  async createAlbum(name: string) {
    return albumSchema.parse(await (await this.request('/albums', 'POST', { albumName: name })).json());
  }
  async addToAlbum(albumId: string, assetId: string) {
    const result = bulkResultSchema.parse(await (await this.request(`/albums/${albumId}/assets`, 'PUT', { ids: [assetId] })).json());
    if (result.length !== 1 || result[0].id !== assetId || (!result[0].success && result[0].error !== 'duplicate')) {
      throw new Error('albumWriteFailed');
    }
  }
  async processedAlbum() {
    const owned = await this.ownedAlbums();
    const matches = owned.filter((a) => a.albumName === PROCESSED);
    if (matches.length > 1) { throw new Error('duplicateProcessed'); }
    if (matches[0]) { return matches[0]; }
    return this.createAlbum(PROCESSED);
  }
  async update(id: string, fields: object) {
    await this.request('/assets', 'PUT', { ids: [id], ...fields });
  }
}
export const albumNameSchema = z.object({ name: z.string().trim().min(1).max(200).refine((v) => v !== PROCESSED) });
