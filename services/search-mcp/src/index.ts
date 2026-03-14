import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4001);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Search MCP" });
});

app.post("/tool", async (req, res) => {
  const query = String(req.body?.query ?? "alignment at scale");
  const delayMs = 180 + Math.round(Math.random() * 520);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  res.json({
    tool: "search",
    query,
    results: [
      `${query} overview`,
      `${query} best practices`,
      `${query} observability case study`,
    ],
    delayMs,
  });
});

app.listen(port, () => {
  console.log(`Search MCP running on http://localhost:${port}`);
});
