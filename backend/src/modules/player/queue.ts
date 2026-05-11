import { prisma } from "../../db/client";
import type { YouTubeVideoDetails } from "../youtube/service";

export interface QueueItemDTO {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  createdAt: string;
}

function toDTO(row: {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  createdAt: Date;
}): QueueItemDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    durationSec: row.durationSec,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listQueue(): Promise<QueueItemDTO[]> {
  const rows = await prisma.queueItem.findMany({
    where: { playedAt: null },
    orderBy: { position: "asc" },
  });
  return rows.map(toDTO);
}

async function nextPosition(): Promise<number> {
  const top = await prisma.queueItem.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (top?.position ?? 0) + 1;
}

export async function enqueue(video: YouTubeVideoDetails): Promise<QueueItemDTO> {
  const position = await nextPosition();
  const row = await prisma.queueItem.create({
    data: {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      position,
    },
  });
  return toDTO(row);
}

export async function removeQueueItem(id: string): Promise<boolean> {
  const result = await prisma.queueItem.deleteMany({ where: { id, playedAt: null } });
  return result.count > 0;
}

export async function popNext(): Promise<QueueItemDTO | null> {
  const row = await prisma.queueItem.findFirst({
    where: { playedAt: null },
    orderBy: { position: "asc" },
  });
  if (!row) return null;
  const updated = await prisma.queueItem.update({
    where: { id: row.id },
    data: { playedAt: new Date() },
  });
  return toDTO(updated);
}
