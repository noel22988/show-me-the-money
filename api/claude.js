// api/claude.js — streaming version
// Streams Anthropic response back chunk by chunk so mobile carrier proxies
// never see an idle connection and time out

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured on server" });

  try {
    const body = req.body;
    if (!body?.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 16000,
        stream: true,
        messages: body.messages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: "Anthropic API error", detail: errText });
    }

    // Stream SSE back to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            fullText += parsed.delta.text;
            // Send heartbeat chunk so connection stays alive
            res.write(`data: ${JSON.stringify({ chunk: parsed.delta.text })}\n\n`);
          }
        } catch (e) {
          // skip malformed chunks
        }
      }
    }

    // Send final complete response in same format as before so App.jsx works unchanged
    res.write(`data: ${JSON.stringify({ done: true, content: [{ type: "text", text: fullText }] })}\n\n`);
    res.end();

  } catch (err) {
    console.error("Claude API error:", err);
    // If headers already sent (streaming started), end gracefully
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Stream error", detail: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Server error", detail: err.message });
    }
  }
}
