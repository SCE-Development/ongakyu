import WebSocket from "ws";
import { config } from "./config";
import { MpvClient } from "./mpv";
import { resolveAudioUrl } from "./ytdlp";

type PiCommand =
  | { type: "load_and_play"; videoId: string; volumePercent?: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "volume"; volumePercent: number }
  | { type: "seek"; positionMs: number }
  | { type: "ping"; ts: number };

type PiEvent =
  | { type: "ready" }
  | { type: "position"; videoId: string; positionMs: number; durationMs: number }
  | { type: "paused"; videoId: string }
  | { type: "resumed"; videoId: string }
  | { type: "ended"; videoId: string }
  | { type: "error"; message: string; videoId?: string }
  | { type: "pong"; ts: number };

export function startBridge(mpv: MpvClient) {
  let socket: WebSocket | null = null;
  let reconnectDelay = config.reconnectBaseMs;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let currentVideoId: string | null = null;
  let currentDurationMs = 0;

  const send = (event: PiEvent) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event));
      } catch (err) {
        console.error("Failed to send Pi event:", err);
      }
    }
  };

  const connect = () => {
    if (!config.wsUrl) {
      console.error("ORACLE_WS_URL not configured. Bridge disabled.");
      return;
    }
    const url = `${config.wsUrl}${config.wsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(config.secret)}`;
    console.log(`[bridge] connecting to ${config.wsUrl}`);
    socket = new WebSocket(url);

    socket.on("open", () => {
      console.log("[bridge] connected");
      reconnectDelay = config.reconnectBaseMs;
      send({ type: "ready" });
    });

    socket.on("message", async (data) => {
      let cmd: PiCommand | null = null;
      try {
        cmd = JSON.parse(data.toString()) as PiCommand;
      } catch {
        return;
      }
      if (!cmd || typeof cmd.type !== "string") return;
      try {
        await handleCommand(cmd);
      } catch (err: any) {
        console.error("Command failed:", err);
        send({
          type: "error",
          message: err?.message || String(err),
          videoId: currentVideoId || undefined,
        });
      }
    });

    socket.on("close", () => {
      console.log("[bridge] disconnected");
      scheduleReconnect();
    });

    socket.on("error", (err) => {
      console.error("[bridge] socket error:", err);
      try {
        socket?.terminate();
      } catch {}
    });
  };

  const scheduleReconnect = () => {
    socket = null;
    if (reconnectTimer) return;
    const jitter = Math.floor(Math.random() * 500);
    const delay = reconnectDelay + jitter;
    console.log(`[bridge] reconnecting in ${delay}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, config.reconnectMaxMs);
      connect();
    }, delay);
  };

  const handleCommand = async (cmd: PiCommand) => {
    switch (cmd.type) {
      case "load_and_play": {
        currentVideoId = cmd.videoId;
        const streamUrl = await resolveAudioUrl(cmd.videoId);
        await mpv.loadUrl(streamUrl);
        if (typeof cmd.volumePercent === "number") {
          await mpv.setVolume(cmd.volumePercent).catch(() => undefined);
        }
        // Try to capture duration shortly after load
        setTimeout(async () => {
          const d = await mpv.getDuration();
          if (d > 0) currentDurationMs = d;
        }, 1500);
        break;
      }
      case "pause":
        await mpv.pause();
        break;
      case "resume":
        await mpv.resume();
        break;
      case "stop":
        await mpv.stop();
        currentVideoId = null;
        break;
      case "volume":
        await mpv.setVolume(cmd.volumePercent);
        break;
      case "seek":
        await mpv.seek(cmd.positionMs);
        break;
      case "ping":
        send({ type: "pong", ts: cmd.ts });
        break;
    }
  };

  // Wire up mpv events to outbound messages
  mpv.on("position", (positionMs: number) => {
    if (!currentVideoId) return;
    send({
      type: "position",
      videoId: currentVideoId,
      positionMs,
      durationMs: currentDurationMs,
    });
  });

  mpv.on("pause", () => {
    if (!currentVideoId) return;
    send({ type: "paused", videoId: currentVideoId });
  });

  mpv.on("resume", () => {
    if (!currentVideoId) return;
    send({ type: "resumed", videoId: currentVideoId });
  });

  mpv.on("end-file", () => {
    if (!currentVideoId) return;
    const id = currentVideoId;
    currentVideoId = null;
    currentDurationMs = 0;
    send({ type: "ended", videoId: id });
  });

  mpv.on("error", (message: string) => {
    send({ type: "error", message, videoId: currentVideoId || undefined });
  });

  connect();
}
