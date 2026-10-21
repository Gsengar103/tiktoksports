# Sports short-video API

NestJS control plane. The phone encodes the thumbnail, preview, and H.264 ladder. This service issues upload URLs, stores keys, and marks a video live only after a frame-match stub and a screening stub pass.

## Local test

```bash
cd backend
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npm run seed
npm run start:dev
```

`GET /health` should report postgres and redis up.

Set `SEED_PASSWORD` before `npm run seed` to create `adult@dev.local`, `teen@dev.local`, and `admin@dev.local`.

`STORAGE=memory` stores uploaded bytes in the API process and serves them at `/dev/objects`. `STORAGE=s3` uses MinIO or any S3 API. Local MinIO keeps objects on disk under `backend/data/minio` (the `media` bucket). Point the same `S3_ENDPOINT`, `S3_BUCKET`, and keys at Amazon S3 later; the object keys do not change. `S3_PUBLIC_ENDPOINT` must be a host the phone or browser can reach. `localhost` only works on this machine.

A caption containing `hold-me`, or `fixture: "mismatch"` on complete (not in production), keeps the video held and out of the feed.

## Admin console

The review UI lives in `admin/`. It signs in with `POST /admin/auth/login` and works the open case queue.

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5173 and sign in as `admin@dev.local` with the seeded password. Approve makes a held video live. Remove takes it down. Keep held leaves the case open.

## Checks

```bash
npm test
npm run test:e2e
bash scripts/smoke.sh http://localhost:3000
```

End-to-end tests need Postgres and Redis. They use `STORAGE=memory`.
