// Serverless function — 300 second timeout (Vercel Pro)
export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  try {
    const body = req.body;

    if (!body?.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 4000,
        messages: body.messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("Claude API error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
