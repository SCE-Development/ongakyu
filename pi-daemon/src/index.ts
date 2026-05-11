import { MpvClient } from "./mpv";
import { startBridge } from "./bridge";

async function main() {
  const mpv = new MpvClient();
  await mpv.start();
  startBridge(mpv);

  const shutdown = (signal: string) => {
    console.log(`[daemon] received ${signal}, shutting down`);
    try {
      mpv.shutdown();
    } catch (err) {
      console.error("Error during shutdown:", err);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[daemon] fatal:", err);
  process.exit(1);
});
