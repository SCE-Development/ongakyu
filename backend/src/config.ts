import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  ytdlpBinary: process.env.YTDLP_BIN || "yt-dlp",
  ytdlpCookiesFile: process.env.YTDLP_COOKIES_FILE || "",
  pi: {
    bridgeSecret: process.env.PI_BRIDGE_SECRET || "change-me",
    wsPath: process.env.PI_WS_PATH || "/ws/pi",
  },
};
