import { ChildProcess, spawn } from "child_process";
import net from "net";
import fs from "fs";
import { EventEmitter } from "events";
import { config } from "./config";

interface MpvResponse {
  request_id?: number;
  error?: string;
  data?: unknown;
  event?: string;
  name?: string;
  reason?: string;
}

type MpvEventType = "position" | "end-file" | "pause" | "resume" | "error";

export declare interface MpvClient {
  on(event: "position", listener: (positionMs: number) => void): this;
  on(event: "end-file", listener: () => void): this;
  on(event: "pause", listener: () => void): this;
  on(event: "resume", listener: () => void): this;
  on(event: "error", listener: (message: string) => void): this;
  on(event: MpvEventType, listener: (...args: any[]) => void): this;
}

export class MpvClient extends EventEmitter {
  private child: ChildProcess | null = null;
  private sock: net.Socket | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private buffer = "";
  private connected = false;
  private lastPositionEmitted = 0;

  async start(): Promise<void> {
    // Remove any stale socket
    try {
      if (fs.existsSync(config.mpvSocket)) fs.unlinkSync(config.mpvSocket);
    } catch {}

    const args = [
      "--no-video",
      "--idle=yes",
      `--input-ipc-server=${config.mpvSocket}`,
      "--no-terminal",
      "--no-input-default-bindings",
      "--really-quiet",
      `--ao=${config.mpvAudioOut}`,
    ];
    if (config.mpvAudioDevice) {
      args.push(`--audio-device=${config.mpvAudioDevice}`);
    }
    this.child = spawn(config.mpvBinary, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.child.on("exit", (code, signal) => {
      console.error(`mpv exited code=${code} signal=${signal}`);
      this.connected = false;
      this.emit("error", `mpv exited code=${code}`);
    });

    // Wait for socket to appear
    await this.waitForSocket();
    await this.connectSocket();

    // Observe properties we care about
    await this.rawCommand(["observe_property", 1, "playback-time"]);
    await this.rawCommand(["observe_property", 2, "pause"]);
  }

  private async waitForSocket(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        if (fs.existsSync(config.mpvSocket)) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`mpv socket did not appear at ${config.mpvSocket}`);
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(config.mpvSocket);
      sock.once("error", reject);
      sock.once("connect", () => {
        sock.off("error", reject);
        this.sock = sock;
        this.connected = true;
        sock.on("data", (chunk) => this.onData(chunk));
        sock.on("error", (err) => {
          console.error("mpv socket error:", err);
          this.emit("error", err.message);
        });
        sock.on("close", () => {
          this.connected = false;
        });
        resolve();
      });
    });
  }

  private onData(chunk: Buffer) {
    this.buffer += chunk.toString("utf8");
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as MpvResponse;
        this.handleMessage(msg);
      } catch (err) {
        // ignore parse errors
      }
    }
  }

  private handleMessage(msg: MpvResponse) {
    // Response to a request
    if (typeof msg.request_id === "number") {
      const pending = this.pending.get(msg.request_id);
      if (pending) {
        this.pending.delete(msg.request_id);
        if (msg.error && msg.error !== "success") {
          pending.reject(new Error(`mpv: ${msg.error}`));
        } else {
          pending.resolve(msg.data);
        }
      }
      return;
    }

    // Async event
    if (msg.event === "property-change") {
      if (msg.name === "playback-time" && typeof msg.data === "number") {
        const positionMs = Math.max(0, Math.round(msg.data * 1000));
        // Throttle emissions to roughly once per second
        if (positionMs - this.lastPositionEmitted >= 900 || positionMs < this.lastPositionEmitted) {
          this.lastPositionEmitted = positionMs;
          this.emit("position", positionMs);
        }
      } else if (msg.name === "pause") {
        if (msg.data === true) this.emit("pause");
        else if (msg.data === false) this.emit("resume");
      }
    } else if (msg.event === "end-file") {
      // reason can be "eof" (normal end), "stop" (user stop), "quit", "error"
      if (msg.reason === "eof") this.emit("end-file");
      else if (msg.reason === "error") this.emit("error", "mpv end-file error");
    }
  }

  private rawCommand(command: unknown[]): Promise<unknown> {
    if (!this.sock || !this.connected) {
      return Promise.reject(new Error("mpv socket not connected"));
    }
    const request_id = this.nextRequestId++;
    const payload = JSON.stringify({ command, request_id }) + "\n";
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject });
      this.sock!.write(payload, (err) => {
        if (err) {
          this.pending.delete(request_id);
          reject(err);
        }
      });
    });
  }

  async loadUrl(url: string): Promise<void> {
    // Clear any pause state so playback begins immediately
    await this.rawCommand(["set_property", "pause", false]).catch(() => undefined);
    await this.rawCommand(["loadfile", url, "replace"]);
    this.lastPositionEmitted = 0;
  }

  async pause(): Promise<void> {
    await this.rawCommand(["set_property", "pause", true]);
  }

  async resume(): Promise<void> {
    await this.rawCommand(["set_property", "pause", false]);
  }

  async stop(): Promise<void> {
    await this.rawCommand(["stop"]);
  }

  async setVolume(percent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    await this.rawCommand(["set_property", "volume", clamped]);
  }

  async seek(positionMs: number): Promise<void> {
    const seconds = Math.max(0, Math.round(positionMs / 1000));
    await this.rawCommand(["seek", seconds, "absolute"]);
  }

  async getDuration(): Promise<number> {
    try {
      const duration = (await this.rawCommand(["get_property", "duration"])) as number | null;
      if (typeof duration !== "number" || !Number.isFinite(duration)) return 0;
      return Math.round(duration * 1000);
    } catch {
      return 0;
    }
  }

  shutdown() {
    try {
      this.sock?.destroy();
    } catch {}
    try {
      this.child?.kill();
    } catch {}
  }
}
