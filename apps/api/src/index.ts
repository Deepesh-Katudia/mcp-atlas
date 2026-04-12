import dotenv from "dotenv";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createApp } from "./app/create-app.js";
import { createRuntime } from "./app/runtime.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

const port = Number(process.env.PORT ?? 4000);
const runtime = createRuntime({
  async listMcps() {
    return [];
  },
});
const app = createApp(runtime);
const httpServer = createServer(app);

new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

httpServer.listen(port, () => {
  console.log(`MCP Atlas API running on http://localhost:${port}`);
});
