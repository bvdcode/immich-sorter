# Immich Cleaner

A self-hosted review desk for Immich photos and videos. Restore dates and locations, add media to multiple albums, and write descriptions in one place.

## Run with Docker

```sh
docker compose up --build -d
```

Open http://localhost:3000, enter your Immich instance URL and API key, then build the library index. The default Compose configuration binds only to the local computer.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm run dev
```

The interface supports English and Russian. No external media service is used.

## Review workflow

The queue uses OR conditions: missing GPS, missing or suspicious date, or no album. Photos and videos can be filtered separately. Processed items are hidden by default. Rebuild the index after changing albums or metadata outside the application.

The editor fetches current metadata. Select a saved location or create one using latitude, longitude and a time zone. A complete timestamp in a camera filename can be proposed as local time. Enable date editing to apply it, and choose the camera's historical time zone. Impossible daylight-saving times are rejected; repeated clock times require an explicit offset.

Select multiple additional albums or create an album. Existing album memberships are preserved. Descriptions are optional. Saving writes only enabled changes, verifies metadata and album memberships, then adds the item to the `Processed` album. “Everything is correct” only marks the item as processed. Skip advances without modifying Immich.

Full timestamps are recognized in names such as `IMG_20240529_151756.jpg` and `2024-05-29_15-17-56.mp4`. Filename differences over 24 hours are flagged for review; they are not automatically corrected. Visual similarity and camera dimensions do not establish a location.

## Permissions

The Immich key needs `user.read`, `asset.read`, `asset.view`, `asset.update`, `album.read`, `album.create`, and `albumAsset.create`. Access is limited to the account and assets available to that key. The application uses Immich's REST API, including paginated metadata search with EXIF. It never connects to the Immich database.

## Persistence and credentials

Media and edited metadata remain in Immich. `Processed` is the durable completion marker. SQLite stores a rebuildable index plus location presets and an edit journal. Loss of the data volume requires reindexing and loses presets and the local journal, but does not revert changes in Immich. Export presets and history from the library screen.

Credentials are encrypted with AES-256-GCM inside an HttpOnly, SameSite=Strict cookie; the encryption key lives in the data volume. Remembered connections expire after 30 days. Other connections use a browser-session cookie with a 24-hour server-side expiry. Disconnect clears the browser's session cookie. Different keys have isolated caches and presets. Deleting the encryption key invalidates all sessions.

## Hosted deployment

Use HTTPS and set `APP_URL` to the public application URL. Set `LOCAL_MODE=false` and `IMMICH_ALLOWED_ORIGINS` to a comma-separated list of trusted Immich origins, for example `https://photos.example.com`. The server refuses arbitrary instance origins in this mode. Keep the data volume private. Configure the reverse proxy to forward to port 3000 and retain the real request origin.

This release is intended for trusted personal or household deployments. Internet-wide multi-tenant hosting, registration, connection rate limiting, private-network egress isolation, and arbitrary-instance public hosting are not implemented.

## Validation

```sh
npm run test
npm run build
npm run typecheck
```

Tests cover timestamp parsing, daylight-saving gaps and overlaps, filter semantics, connection isolation, encrypted sessions, write-origin protection, stale edits, partial writes and the order of the Processed marker. CI also builds the Docker image.

## Current limits

Reviews operate on one item at a time. Indexing is driven by the open browser tab and can be paused between pages. Media cache and album membership are snapshots until refreshed; current asset metadata is checked before every save. There is no automatic rollback of partially completed remote writes. The edit journal records before and after values; failed writes stay outside Processed and require inspection. Automatic visual grouping and one-click undo are not implemented.
