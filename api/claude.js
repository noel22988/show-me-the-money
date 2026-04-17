// api/claude.js — streaming with heartbeat keep-alive
// Sends heartbeats every 5 seconds to prevent carrier proxy and WiFi proxy timeouts

export const config = {
  maxDuration: 300, // Vercel Pro plan supports up to 300s
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

    // Start SSE stream immediately so client/proxies know connection is alive
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Heartbeat ticker — sends ping every 5s to keep connection alive
    let heartbeatActive = true;
    const heartbeat = setInterval(() => {
      if (heartbeatActive) {
        try {
          res.write(`: heartbeat\n\n`); // SSE comment line, ignored by client but keeps connection alive
        } catch (e) {
          heartbeatActive = false;
        }
      }
    }, 5000);

    // Send initial ready event
    res.write(`data: ${JSON.stringify({ status: "processing" })}\n\n`);

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
      heartbeatActive = false;
      clearInterval(heartbeat);
      res.write(`data: ${JSON.stringify({ error: "Anthropic API error", detail: errText, status: upstream.status })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            fullText += parsed.delta.text;
            res.write(`data: ${JSON.stringify({ chunk: parsed.delta.text })}\n\n`);
          }
        } catch (e) {
          // skip malformed chunks
        }
      }
    }

    heartbeatActive = false;
    clearInterval(heartbeat);

    // Send final complete response
    res.write(`data: ${JSON.stringify({ done: true, content: [{ type: "text", text: fullText }] })}\n\n`);
    res.end();

  } catch (err) {
    console.error("Claude API error:", err);
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ error: "Stream error", detail: err.message })}\n\n`);
        res.end();
      } catch (e) {}
    } else {
      res.status(500).json({ error: "Server error", detail: err.message });
    }
  }
}
