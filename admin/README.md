# Sports review console

Staff UI for the open moderation queue.

```bash
cd admin
npm install
npm run dev
```

The dev server proxies `/admin` to `http://localhost:3000`. Set `VITE_API_URL` when the API is on another host.

Sign in with a moderator or super-admin account, such as the seeded `admin@dev.local`. Approve publishes a held video. Remove takes it down. Keep held leaves the case open and records the reason.
