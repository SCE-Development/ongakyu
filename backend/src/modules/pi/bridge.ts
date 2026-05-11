import http from "http";
import crypto from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { EventEmitter } from "events";
import { config } from "../../config";
import { setPiConnected, updateState } from "../player/state";

export type PiCommand =
  | { type: "load_and_play"; videoId: string; volumePercent?: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "volume"; volumePercent: number }
  | { type: "seek"; positionMs: number }
  | { type: "ping"; ts: number };

export type PiEvent =
  | { type: "ready" }
  | { type: "position"; videoId: string; positionMs: number; durationMs: number }
  | { type: "paused"; videoId: string }
  | { type: "resumed"; videoId: string }
  | { type: "ended"; videoId: string }
  | { type: "error"; message: string; videoId?: string }
  | { type: "pong"; ts: number };

const emitter = new EventEmitter();
let activeSocket: WebSocket | null = null;
let pingTimer: NodeJS.Timeout | null = null;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function handleConnect(ws: WebSocket) {
  if (activeSocket && activeSocket !== ws) {
    try {
      activeSocket.close(1000, "Replaced by new connection");
    } catch {}
  }
  activeSocket = ws;
  await setPiConnected(true);

  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
      try {
        activeSocket.ping();
      } catch {}
    }
  }, 20_000);

  ws.on("message", async (data) => {
    let event: PiEvent | null = null;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!event || typeof event !== "object" || typeof (event as any).type !== "string") return;
    emitter.emit("event", event);
  });

  const cleanup = async () => {
    if (activeSocket === ws) {
      activeSocket = null;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      try {
        await setPiConnected(false);
        await updateState({ isPlaying: false });
      } catch (err) {
        console.error("Failed to mark Pi disconnected:", err);
      }
    }
  };

  ws.on("close", cleanup);
  ws.on("error", (err) => {
    console.error("Pi WebSocket error:", err);
    cleanup();
  });
}

export function attachPiBridge(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { url } = req;
    if (!url) {
      socket.destroy();
      return;
    }
    const parsed = new URL(url, "http://placeholder");
    if (parsed.pathname !== config.pi.wsPath) {
      return;
    }

    const token = parsed.searchParams.get("token") || "";
    if (!config.pi.bridgeSecret || !safeEqual(token, config.pi.bridgeSecret)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnect(ws).catch((err) => {
        console.error("Pi bridge connect failed:", err);
        ws.close(1011, "server error");
      });
    });
  });
}

export function sendCommand(cmd: PiCommand): boolean {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return false;
  try {
    activeSocket.send(JSON.stringify(cmd));
    return true;
  } catch (err) {
    console.error("Failed to send Pi command:", err);
    return false;
  }
}

export function isPiConnected(): boolean {
  return !!activeSocket && activeSocket.readyState === WebSocket.OPEN;
}

export function onPiEvent(handler: (event: PiEvent) => void): void {
  emitter.on("event", handler);
}
