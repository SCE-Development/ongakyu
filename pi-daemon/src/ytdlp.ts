import { execFile } from "child_process";
import { config } from "./config";

export function resolveAudioUrl(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    execFile(
      config.ytdlpBinary,
      ["-g", "-f", "bestaudio", "--no-playlist", url],
      { timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`yt-dlp failed: ${stderr?.trim() || err.message}`));
          return;
        }
        const streamUrl = stdout.trim().split("\n").find((line) => line.startsWith("http"));
        if (!streamUrl) {
          reject(new Error(`yt-dlp returned no URL for ${videoId}`));
          return;
        }
        resolve(streamUrl);
      },
    );
  });
}
