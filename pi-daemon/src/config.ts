import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  wsUrl: process.env.ORACLE_WS_URL || "",
  secret: process.env.PI_BRIDGE_SECRET || "",
  mpvSocket: process.env.MPV_SOCKET || "/tmp/mpv-socket",
  mpvBinary: process.env.MPV_BIN || "mpv",
  mpvAudioOut: process.env.MPV_AUDIO_OUT || "alsa",
  mpvAudioDevice: process.env.MPV_AUDIO_DEVICE || "",
  ytdlpBinary: process.env.YTDLP_BIN || "yt-dlp",
  reconnectBaseMs: 1000,
  reconnectMaxMs: 30_000,
  positionReportMs: 1000,
};
