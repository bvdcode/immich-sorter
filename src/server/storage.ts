import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { assetSchema, presetsSchema, type Asset, type Filters, type Preset } from '@/lib/contracts';
import { dateNeedsReview } from '@/lib/dates';

export function dataDirectory() {
  const directory = process.env.DATA_DIR ?? join(process.cwd(), '.data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export class Storage {
  private readonly db: DatabaseSync;
  constructor(private readonly scope: string) {
    this.db = new DatabaseSync(join(dataDirectory(), 'cache.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS assets (
        scope TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, filename TEXT NOT NULL,
        type TEXT NOT NULL, gps INTEGER NOT NULL, date INTEGER NOT NULL,
        no_album INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(scope,id));
      CREATE TABLE IF NOT EXISTS settings (scope TEXT NOT NULL, key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(scope,key));
      CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, scope TEXT NOT NULL, asset TEXT NOT NULL, created TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assets_scope_name ON assets(scope,filename,id);`);
  }
  close() { this.db.close(); }
  reset() {
    this.db.prepare('DELETE FROM assets WHERE scope=?').run(this.scope);
    this.set('indexed', false);
  }
  cache(assets: Asset[]) {
    const statement = this.db.prepare(`INSERT INTO assets(scope,id,json,filename,type,gps,date) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(scope,id) DO UPDATE SET json=excluded.json, filename=excluded.filename,
      type=excluded.type,gps=excluded.gps,date=excluded.date`);
    this.db.exec('BEGIN');
    try {
      for (const asset of assets) {
        if (asset.isTrashed || asset.isOffline || !['IMAGE', 'VIDEO'].includes(asset.type)) { continue; }
        statement.run(this.scope, asset.id, JSON.stringify(asset), asset.originalFileName, asset.type,
          Number(asset.exifInfo?.latitude == null || asset.exifInfo?.longitude == null), Number(dateNeedsReview(asset)));
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  mark(ids: string[], kind: 'no_album' | 'processed', value: boolean) {
    const statement = this.db.prepare(`UPDATE assets SET ${kind}=? WHERE scope=? AND id=?`);
    for (const id of ids) { statement.run(Number(value), this.scope, id); }
  }
  queue(filters: Filters, after: string | null) {
    const reasons: string[] = [];
    if (filters.gps) { reasons.push('gps=1'); }
    if (filters.date) { reasons.push('date=1'); }
    if (filters.album) { reasons.push('no_album=1'); }
    const where = ['scope=?'];
    const values: string[] = [this.scope];
    if (!filters.includeProcessed) { where.push('processed=0'); }
    if (!filters.all) { where.push(reasons.length ? `(${reasons.join(' OR ')})` : '0=1'); }
    if (filters.type !== 'ALL') { where.push('type=?'); values.push(filters.type); }
    const total = z.object({ count: z.number() }).parse(this.db.prepare(`SELECT COUNT(*) as count FROM assets WHERE ${where.join(' AND ')}`).get(...values)).count;
    if (after) { where.push("filename || '/' || id > ?"); values.push(after); }
    const rows = this.db.prepare(`SELECT json,no_album,processed FROM assets WHERE ${where.join(' AND ')} ORDER BY filename,id LIMIT 20`).all(...values);
    return { total, items: rows.map((row) => {
      const parsed = z.object({ json: z.string(), no_album: z.number(), processed: z.number() }).parse(row);
      const asset = assetSchema.parse(JSON.parse(parsed.json));
      return { asset, noAlbum: parsed.no_album === 1, processed: parsed.processed === 1,
        cursor: `${asset.originalFileName}/${asset.id}` };
    }) };
  }
  get(key: string) {
    const row = this.db.prepare('SELECT json FROM settings WHERE scope=? AND key=?').get(this.scope, key);
    return row ? z.object({ json: z.string() }).parse(row).json : null;
  }
  set(key: string, value: string | number | boolean | Preset[]) {
    this.db.prepare('INSERT INTO settings VALUES(?,?,?) ON CONFLICT(scope,key) DO UPDATE SET json=excluded.json').run(this.scope, key, JSON.stringify(value));
  }
  presets() { const value = this.get('presets'); return value ? presetsSchema.parse(JSON.parse(value)) : []; }
  journal(id: string, json: string) {
    this.db.prepare('INSERT INTO history(scope,asset,created,json) VALUES(?,?,?,?)').run(this.scope, id, new Date().toISOString(), json);
  }
  history() {
    return this.db.prepare('SELECT asset,created,json FROM history WHERE scope=? ORDER BY id DESC LIMIT 1000').all(this.scope);
  }
  count() { return z.object({ count: z.number() }).parse(this.db.prepare('SELECT COUNT(*) as count FROM assets WHERE scope=?').get(this.scope)).count; }
}
