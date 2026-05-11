import { Router, Request, Response } from "express";
import { searchWithDurations } from "../modules/youtube/service";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) {
    res.status(400).json({ error: "Search query required" });
    return;
  }
  try {
    const results = await searchWithDurations(q);
    res.json({ results });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "YouTube search failed" });
  }
});

export default router;
