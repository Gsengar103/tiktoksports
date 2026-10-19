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

`STORAGE=memory` skips S3 and returns `memory://` URLs. Use that for automated tests. Use MinIO (`STORAGE=s3` in `.env.example`) when a phone must upload real bytes. Point `S3_PUBLIC_ENDPOINT` at a host the phone can reach. `localhost` only works for curl on this machine.

A caption containing `hold-me`, or `fixture: "mismatch"` on complete (not in production), keeps the video held and out of the feed.

## Checks

```bash
npm test
npm run test:e2e
bash scripts/smoke.sh http://localhost:3000
```

End-to-end tests need Postgres and Redis. They use `STORAGE=memory`.
