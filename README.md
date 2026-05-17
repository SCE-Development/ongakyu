# OngaKyu - 音楽キュウ

Basic Web UI for people to use easily. Users can search things on YouTube then have it played on Raspberry Pi.

```
[Browser] ──► [Frontend (Nginx)] ──► [Backend (Express + SQLite)] ──WebSocket──► [Pi (mpv + yt-dlp)]
```

The Pi opens a WebSocket connection outbound, so no inbound firewall holes are needed. When something gets played, `yt-dlp` fetches the audio stream URL from YouTube and hands it to `mpv`, which streams it directly through ALSA to the speakers so nothin needs to be saved on the Pi with limited storage. Yt-dlp needs a netscape format cookie file depending on the IP address to avoid bot detection. In this case the cookie file is needed because the backend is ran off a server SSH tunneled to Oracle cloud.

## Run (Docker)

```bash
git clone https://github.com/SCE-Development/ongakyu.git
cd ongakyu
cp backend/.env.example backend/.env  # set PI_BRIDGE_SECRET
docker compose up -d
```

Frontend on `:80`, backend API on `:3001`.

## Run (For Local Testing)

Requires Node.js 20+ and `yt-dlp` on `$PATH`.

```bash
npm install
cp backend/.env.example backend/.env
npx -w backend prisma db push --schema=../prisma/schema.prisma
npm -w backend run db:seed
npm -w backend run dev    # :3001
npm -w frontend run dev   # :5173
```

## Raspberry Pi setup

```bash
sudo apt install -y mpv python3-pip
sudo pip3 install -U yt-dlp

# Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh && nvm install 20

git clone https://github.com/SCE-Development/ongakyu.git ~/ongakyu
cd ~/ongakyu/pi-daemon
npm install && npm run build
cp .env.example .env  # need to manually enter ORACLE_WS_URL and PI_BRIDGE_SECRET
# to generate secret, you can do "openssl rand -hex 32"
sudo cp systemd/ongakyu-pi.service /etc/systemd/system/ # moves premade systemctl daemon to custom unit file dir
sudo systemctl daemon-reload && sudo systemctl enable --now ongakyu-pi
```

## Environment

`backend/.env`:

| Variable             | Required | Notes |
|----------------------|----------|-------|
| `DATABASE_URL`       | yes      | SQLite path, e.g. `file:./dev.db` |
| `PI_BRIDGE_SECRET`   | yes      | Must match Pi daemon |
| `PORT`               | no       | Defaults to `3001` |
| `PI_WS_PATH`         | no       | Defaults to `/ws/pi` |
| `YTDLP_BIN`          | no       | Path to `yt-dlp` (defaults to `$PATH`) |
| `YTDLP_COOKIES_FILE` | no       | Netscape `cookies.txt` — needed for YouTube bot-checks |

`pi-daemon/.env`:

| Variable           | Required | Notes |
|--------------------|----------|-------|
| `ORACLE_WS_URL`    | yes      | e.g. `wss://host/ws/pi` |
| `PI_BRIDGE_SECRET` | yes      | Must match backend |
| `MPV_SOCKET`       | no       | Defaults to `/tmp/mpv-socket` |
| `MPV_BIN`          | no       | Defaults to `mpv` |
| `YTDLP_BIN`        | no       | Defaults to `yt-dlp` |

## API

| Method | Path                    | Description |
|--------|-------------------------|-------------|
| GET    | `/api/player/state`     | Current track + Pi status |
| GET    | `/api/player/queue`     | Queue + currently playing |
| POST   | `/api/player/queue`     | Add `{ videoId }` |
| DELETE | `/api/player/queue/:id` | Remove queue item |
| POST   | `/api/player/play`      | Resume or play `{ videoId }` |
| POST   | `/api/player/pause`     | Pause |
| POST   | `/api/player/next`      | Skip |
| PUT    | `/api/player/volume`    | `{ volumePercent: 0..100 }` |
| GET    | `/api/search?q=...`     | YouTube search via yt-dlp |
| WS     | `/ws/pi?token=<secret>` | Pi daemon endpoint |

## Layout

```
ongakyu/
├── frontend/    React + Vite
├── backend/     Express + Prisma/SQLite + WebSocket bridge
├── pi-daemon/   Pi-side daemon (mpv + yt-dlp + systemd)
└── prisma/      Schema + seed
```

## License

MIT
