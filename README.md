# Immich Sorter

A self-hosted review desk for Immich photos and videos. Restore dates and locations, add media to multiple albums, and write descriptions in one place.

## Run with Docker

```sh
docker compose pull
docker compose up -d
```

Open http://localhost:3000, enter your Immich instance URL and API key, then build the library index. The default Compose configuration binds only to the local computer.

The prebuilt image is published as `bvdcode/immich-sorter:latest`. To build from source instead, run `docker build -t bvdcode/immich-sorter:latest .` before `docker compose up -d`.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm run dev
```

The interface supports English and Russian. No external media service is used.

## Docker Hub publication

Set the GitHub repository variable `DOCKERHUB_USERNAME` to the Docker Hub account name and the Actions secret `DOCKERHUB_TOKEN` to a Docker Hub personal access token with Read & Write permissions. The destination repository is `<account>/immich-sorter`; create it as public in Docker Hub.

The Checks workflow publishes on pushes to `main` and manual runs on `main`, after tests, lint, type checking, image build and container startup checks succeed. Pull requests never publish. The exact tested Linux AMD64 image is uploaded with `latest` and `sha-<full commit SHA>` tags.

After the first successful publication, run the prebuilt image without cloning or building:

```sh
docker run -d --name immich-sorter --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v sorter-data:/app/data \
  bvdcode/immich-sorter:latest
```

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

No application URL, deployment mode or instance allowlist is required. Enter the Immich URL and API key in the interface. For hosted use, put the application behind HTTPS and restrict access to trusted users with your reverse proxy or VPN. Keep the data volume private and forward requests to port 3000 without rewriting the browser's Origin header. HTTPS browser connections receive Secure session cookies, including when the proxy connects to the container over HTTP.

Write requests require a custom browser request header. Cross-origin requests are not granted CORS permission, and cross-site Fetch Metadata requests are rejected. Do not configure the proxy to allow cross-origin API requests. Users who can access the application can connect to HTTP(S) endpoints reachable from its server; do not expose it as an unrestricted public proxy.

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
