import { prisma } from "../../db/client";

const SINGLETON_ID = "current";

export interface PlayerStateDTO {
  videoId: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  volumePercent: number;
  piConnected: boolean;
}

function toDTO(row: {
  videoId: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  positionMs: number;
  isPlaying: boolean;
  volumePercent: number;
  piConnected: boolean;
}): PlayerStateDTO {
  return {
    videoId: row.videoId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    durationMs: row.durationMs ?? 0,
    positionMs: row.positionMs,
    isPlaying: row.isPlaying,
    volumePercent: row.volumePercent,
    piConnected: row.piConnected,
  };
}

async function ensureRow() {
  return prisma.playerState.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

export async function getState(): Promise<PlayerStateDTO> {
  const row = await ensureRow();
  return toDTO(row);
}

export async function updateState(patch: Partial<Omit<PlayerStateDTO, "piConnected">> & { piConnected?: boolean }): Promise<PlayerStateDTO> {
  await ensureRow();
  const row = await prisma.playerState.update({
    where: { id: SINGLETON_ID },
    data: {
      videoId: patch.videoId === undefined ? undefined : patch.videoId,
      title: patch.title === undefined ? undefined : patch.title,
      channelTitle: patch.channelTitle === undefined ? undefined : patch.channelTitle,
      thumbnailUrl: patch.thumbnailUrl === undefined ? undefined : patch.thumbnailUrl,
      durationMs: patch.durationMs === undefined ? undefined : patch.durationMs,
      positionMs: patch.positionMs === undefined ? undefined : patch.positionMs,
      isPlaying: patch.isPlaying === undefined ? undefined : patch.isPlaying,
      volumePercent: patch.volumePercent === undefined ? undefined : patch.volumePercent,
      piConnected: patch.piConnected === undefined ? undefined : patch.piConnected,
    },
  });
  return toDTO(row);
}

export async function setNowPlaying(item: {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
}): Promise<PlayerStateDTO> {
  return updateState({
    videoId: item.videoId,
    title: item.title,
    channelTitle: item.channelTitle,
    thumbnailUrl: item.thumbnailUrl,
    durationMs: item.durationSec * 1000,
    positionMs: 0,
    isPlaying: true,
  });
}

export async function clearNowPlaying(): Promise<PlayerStateDTO> {
  return updateState({
    videoId: null,
    title: null,
    channelTitle: null,
    thumbnailUrl: null,
    durationMs: 0,
    positionMs: 0,
    isPlaying: false,
  });
}

export async function setPiConnected(connected: boolean): Promise<PlayerStateDTO> {
  return updateState({ piConnected: connected });
}
