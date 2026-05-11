# OngaKyuu Pi daemon

Headless audio player that runs on a Raspberry Pi. Opens an outbound WebSocket
to the Oracle backend and plays YouTube audio through `mpv` (fed by `yt-dlp`).

```
[Oracle backend] ──WebSocket──► [pi-daemon] ──IPC──► mpv ──ALSA──► speaker
                                       │
                                       └─ yt-dlp -g -f bestaudio
```

## One-time Pi setup

SSH into the Pi (`pi@<lan-ip>`) and run:

```bash
# 1. System packages
sudo apt update
sudo apt install -y mpv python3-pip git

# 2. yt-dlp (pip is more current than apt)
sudo pip3 install -U yt-dlp

# 3. Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20

# 4. Clone the repo (youtube branch)
git clone -b youtube https://github.com/SCE-Development/ongakyu.git ~/ongakyu
cd ~/ongakyu/pi-daemon

# 5. Install + build
npm install
npm run build

# 6. Configure
cp .env.example .env
# edit .env: set ORACLE_WS_URL and PI_BRIDGE_SECRET

# 7. Install systemd unit
sudo cp systemd/ongakyu-pi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ongakyu-pi
sudo systemctl status ongakyu-pi
```

If `nvm` installs a Node version other than `v20.20.1`, update the `ExecStart`
path in `/etc/systemd/system/ongakyu-pi.service` accordingly (`which node`).

## GitHub Actions self-hosted runner

The CI/CD pipeline includes a `deploy-pi` job that runs on a self-hosted
runner labelled `pi`. Register one on the Pi:

1. In the GitHub repo: **Settings → Actions → Runners → New self-hosted
   runner**, select Linux ARM64.
2. Follow the displayed commands on the Pi (download, configure, run as a
   service). When prompted for labels, add `pi`.
3. Allow the runner user to restart the service without a password:

   ```bash
   echo "pi ALL=(ALL) NOPASSWD: /bin/systemctl restart ongakyu-pi" \
     | sudo tee /etc/sudoers.d/ongakyu-pi
   sudo chmod 440 /etc/sudoers.d/ongakyu-pi
   ```

## Local dev

```bash
npm install
npm run dev   # tsx watcher
```

You'll need `mpv` and `yt-dlp` on `$PATH`. Point `ORACLE_WS_URL` at a backend
you can reach (e.g. `ws://localhost:4000/ws/pi`).

## Environment variables

| Variable           | Description                                   | Default            |
| ------------------ | --------------------------------------------- | ------------------ |
| `ORACLE_WS_URL`    | WebSocket URL of the Oracle backend           | _(required)_       |
| `PI_BRIDGE_SECRET` | Shared secret matching the Oracle config      | _(required)_       |
| `MPV_SOCKET`       | Unix socket path for mpv IPC                  | `/tmp/mpv-socket`  |
| `MPV_BIN`          | Path to the `mpv` binary                      | `mpv`              |
| `YTDLP_BIN`        | Path to the `yt-dlp` binary                   | `yt-dlp`           |

## Troubleshooting

- `journalctl -u ongakyu-pi -f` — live logs.
- `echo '{"command":["get_property","playback-time"]}' | socat - /tmp/mpv-socket`
  — verify mpv IPC is alive.
- `yt-dlp -g -f bestaudio https://youtu.be/dQw4w9WgXcQ` — verify yt-dlp can
  resolve a stream URL.
- If audio is silent, run `alsamixer` and unmute / raise the master volume.
