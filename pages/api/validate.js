export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, email, ideaSummary, captureOnly } = req.body;

  if (captureOnly) {
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (process.env.LOOPS_API_KEY) {
      try {
        const contactRes = await fetch("https://app.loops.so/api/v1/contacts/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.LOOPS_API_KEY}`,
          },
          body: JSON.stringify({
            email,
            source: "idea-validator",
            ideaSummary: String(ideaSummary || "").slice(0, 2000),
            ...(process.env.LOOPS_MAILING_LIST_ID?.trim() ? { mailingLists: { [process.env.LOOPS_MAILING_LIST_ID.trim()]: true } } : {}),
          }),
        });

        if (!contactRes.ok) console.error("Loops contact error:", contactRes.status);
      } catch (captureErr) {
        console.error("Loops capture error:", captureErr);
      }
    }

    return res.status(200).json({ captured: true });
  }

  if (!prompt) return res.status(400).json({ error: "No prompt provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return res.status(500).json({ error: `No JSON found: ${text.slice(0, 200)}` });

    let jsonStr = text.slice(start, end + 1);
    try {
      return res.status(200).json(JSON.parse(jsonStr));
    } catch (parseErr) {
      // Truncated mid-array/object — likely hit max_tokens. Surface a clear error.
      return res.status(500).json({ error: `Response was cut off before completing (stop_reason: ${data.stop_reason}). Try again — this is usually a one-off.` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
