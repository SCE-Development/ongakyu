import { onPiEvent, sendCommand, type PiEvent } from "./bridge";
import {
  clearNowPlaying,
  getState,
  setNowPlaying,
  updateState,
} from "../player/state";
import { popNext } from "../player/queue";

export async function advanceToNext(): Promise<boolean> {
  const next = await popNext();
  if (!next) {
    await clearNowPlaying();
    return false;
  }

  await setNowPlaying({
    videoId: next.videoId,
    title: next.title,
    channelTitle: next.channelTitle,
    thumbnailUrl: next.thumbnailUrl,
    durationSec: next.durationSec,
  });
  const state = await getState();
  sendCommand({
    type: "load_and_play",
    videoId: next.videoId,
    volumePercent: state.volumePercent,
  });
  return true;
}

onPiEvent(async (event: PiEvent) => {
  try {
    switch (event.type) {
      case "position":
        await updateState({
          positionMs: event.positionMs,
          durationMs: event.durationMs || undefined,
          isPlaying: true,
        });
        break;

      case "paused":
        await updateState({ isPlaying: false });
        break;

      case "resumed":
        await updateState({ isPlaying: true });
        break;

      case "ended":
        await advanceToNext();
        break;

      case "error":
        console.error("Pi reported error:", event.message);
        await updateState({ isPlaying: false });
        break;

      case "ready": {
        const state = await getState();
        sendCommand({ type: "volume", volumePercent: state.volumePercent });
        break;
      }

      case "pong":
        break;
    }
  } catch (err) {
    console.error("Error handling Pi event:", err);
  }
});
