import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4003);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "File MCP" });
});

app.post("/tool", async (req, res) => {
  const filename = String(req.body?.filename ?? "notes.txt");
  const forceFailure = Boolean(req.body?.forceFailure);
  const delayMs = 200 + Math.round(Math.random() * 650);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (forceFailure) {
    res.status(500).json({ tool: "file", error: `File service failed for ${filename}` });
    return;
  }

  res.json({
    tool: "file",
    filename,
    content: `Mock file content loaded from ${filename}`,
    metadata: {
      sizeBytes: 2048,
      type: "text/plain",
    },
    delayMs,
  });
});

app.listen(port, () => {
  console.log(`File MCP running on http://localhost:${port}`);
});
