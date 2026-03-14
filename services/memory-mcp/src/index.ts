import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4002);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Memory MCP" });
});

app.post("/tool", async (req, res) => {
  const topic = String(req.body?.topic ?? req.body?.query ?? "restaurants");
  const userId = String(req.body?.userId ?? "u1");
  const delayMs = 120 + Math.round(Math.random() * 420);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  res.json({
    tool: "memory",
    userId,
    topic,
    memories: [
      `User ${userId} asked about ${topic} recently`,
      `User ${userId} prefers concise summaries`,
      `Prior context linked to ${topic}`,
    ],
    delayMs,
  });
});

app.listen(port, () => {
  console.log(`Memory MCP running on http://localhost:${port}`);
});
