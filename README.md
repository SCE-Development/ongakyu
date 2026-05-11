# OngaKyu

Web UI for a shared speaker. Anyone with the URL can search YouTube, queue tracks, and control playback on a Raspberry Pi.

```
[Browser] ──► [Backend (Express + SQLite)] ──WebSocket──► [Pi (mpv + yt-dlp)]
```

The backend serves the frontend, calls `yt-dlp` for search/metadata, and forwards playback commands to the Pi over a WebSocket. The Pi opens the connection outbound, so no inbound firewall holes are needed.

## Prerequisites

- Node.js 20+
- `yt-dlp` on `$PATH` (used by the backend for search/metadata and by the Pi for audio streams)
- `mpv` on the Pi for playback

## Setup

```bash
git clone https://github.com/SCE-Development/ongakyu.git
cd ongakyu
npm install

cp backend/.env.example backend/.env   # edit PI_BRIDGE_SECRET

npx -w backend prisma db push --schema=../prisma/schema.prisma
npm -w backend run db:seed
```

## Run (dev)

```bash
npm -w backend run dev    # http://localhost:3001
npm -w frontend run dev   # http://localhost:5173
```

## Run (prod, with PM2)

```bash
npm -w backend run build
npm -w frontend run build
pm2 start ecosystem.config.cjs
```

The backend serves `frontend/dist` as static files, so one process is enough.

## Raspberry Pi setup

See [`pi-daemon/README.md`](pi-daemon/README.md). Quick version: install `mpv` + `yt-dlp` + Node 20, `npm install && npm run build` in `pi-daemon/`, set `ORACLE_WS_URL` and `PI_BRIDGE_SECRET` in its `.env`, install the bundled systemd unit.

## Environment

`backend/.env`:

| Variable           | Required | Notes                                                       |
|--------------------|----------|-------------------------------------------------------------|
| `DATABASE_URL`     | yes      | SQLite path, e.g. `file:./dev.db`                           |
| `PORT`             | no       | Defaults to `3001`                                          |
| `PI_BRIDGE_SECRET` | yes      | Must match the Pi daemon's `PI_BRIDGE_SECRET`               |
| `PI_WS_PATH`       | no       | Defaults to `/ws/pi`                                        |
| `YTDLP_BIN`        | no       | Path to `yt-dlp` binary (defaults to `yt-dlp` on `$PATH`)   |
| `YTDLP_COOKIES_FILE` | no     | Absolute path to a Netscape-format `cookies.txt` for yt-dlp. Needed when YouTube returns "Sign in to confirm you're not a bot." Export from a logged-in browser (use a burner Google account) with an extension like "Get cookies.txt LOCALLY". The Pi daemon honors the same variable. |

## API

All endpoints are open — anyone who can reach the backend can control the player.

| Method | Path                          | What                       |
|--------|-------------------------------|----------------------------|
| GET    | `/api/player/state`           | Current track + Pi status  |
| GET    | `/api/player/queue`           | Queue + currently playing  |
| POST   | `/api/player/queue`           | Add `{ videoId }`          |
| DELETE | `/api/player/queue/:id`       | Remove queue item          |
| POST   | `/api/player/play`            | Resume, or play `videoId`  |
| POST   | `/api/player/pause`           | Pause                      |
| POST   | `/api/player/next`            | Skip                       |
| PUT    | `/api/player/volume`          | `{ volumePercent: 0..100 }`|
| GET    | `/api/search?q=...`           | yt-dlp search              |
| WS     | `/ws/pi?token=<secret>`       | Pi daemon connects here    |

## Layout

```
ongakyu/
├── frontend/    React + Vite, single page
├── backend/     Express + Prisma/SQLite + Pi WebSocket bridge
├── pi-daemon/   Pi-side daemon (mpv + yt-dlp)
└── prisma/      Schema + seed
```

## License

MIT
