import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { config } from "./config";

import playerRoutes from "./routes/player";
import searchRoutes from "./routes/search";

import { attachPiBridge } from "./modules/pi/bridge";
import "./modules/pi/events";

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

app.use("/api/player", playerRoutes);
app.use("/api/search", searchRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

const server = http.createServer(app);
attachPiBridge(server);

server.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  console.log(`Pi bridge listening on ws path ${config.pi.wsPath}`);
});
