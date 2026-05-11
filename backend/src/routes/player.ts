import { Router, Request, Response } from "express";
import { getVideoDetails } from "../modules/youtube/service";
import {
  getState,
  setNowPlaying,
  updateState,
} from "../modules/player/state";
import {
  enqueue,
  listQueue,
  popNext,
  removeQueueItem,
} from "../modules/player/queue";
import { isPiConnected, sendCommand } from "../modules/pi/bridge";
import { advanceToNext } from "../modules/pi/events";

const router = Router();

async function resolveVideo(videoId: string) {
  const details = await getVideoDetails([videoId]);
  if (details.length === 0) throw new Error(`Video not found: ${videoId}`);
  return details[0];
}

async function startPlaying(videoId: string) {
  const video = await resolveVideo(videoId);
  await setNowPlaying(video);
  const state = await getState();
  sendCommand({
    type: "load_and_play",
    videoId: video.videoId,
    volumePercent: state.volumePercent,
  });
  return video;
}

router.get("/state", async (_req: Request, res: Response) => {
  const state = await getState();
  res.json(state);
});

router.get("/queue", async (_req: Request, res: Response) => {
  const [state, queue] = await Promise.all([getState(), listQueue()]);
  res.json({ currentlyPlaying: state, queue });
});

router.post("/queue", async (req: Request, res: Response) => {
  const videoId = typeof req.body?.videoId === "string" ? req.body.videoId : "";
  if (!videoId) {
    res.status(400).json({ error: "videoId required" });
    return;
  }
  try {
    const video = await resolveVideo(videoId);
    const item = await enqueue(video);

    const state = await getState();
    if (!state.videoId && isPiConnected()) {
      const next = await popNext();
      if (next) {
        await setNowPlaying({
          videoId: next.videoId,
          title: next.title,
          channelTitle: next.channelTitle,
          thumbnailUrl: next.thumbnailUrl,
          durationSec: next.durationSec,
        });
        sendCommand({
          type: "load_and_play",
          videoId: next.videoId,
          volumePercent: state.volumePercent,
        });
      }
    }

    res.json({ item });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to enqueue" });
  }
});

router.delete("/queue/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const removed = await removeQueueItem(id);
  if (!removed) {
    res.status(404).json({ error: "Queue item not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/play", async (req: Request, res: Response) => {
  const videoId = typeof req.body?.videoId === "string" ? req.body.videoId : "";
  try {
    if (!isPiConnected()) {
      res.status(503).json({ error: "Pi not connected" });
      return;
    }
    if (videoId) {
      await startPlaying(videoId);
    } else {
      sendCommand({ type: "resume" });
      await updateState({ isPlaying: true });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to play" });
  }
});

router.post("/pause", async (_req: Request, res: Response) => {
  if (!isPiConnected()) {
    res.status(503).json({ error: "Pi not connected" });
    return;
  }
  sendCommand({ type: "pause" });
  await updateState({ isPlaying: false });
  res.json({ ok: true });
});

router.post("/next", async (_req: Request, res: Response) => {
  if (!isPiConnected()) {
    res.status(503).json({ error: "Pi not connected" });
    return;
  }
  const advanced = await advanceToNext();
  res.json({ ok: true, advanced });
});

router.put("/volume", async (req: Request, res: Response) => {
  const raw = Number(req.body?.volumePercent);
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
    res.status(400).json({ error: "volumePercent must be between 0 and 100" });
    return;
  }
  const volumePercent = Math.round(raw);
  await updateState({ volumePercent });
  sendCommand({ type: "volume", volumePercent });
  res.json({ ok: true });
});

export default router;
