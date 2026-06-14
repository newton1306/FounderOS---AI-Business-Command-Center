import type { Handler } from "@netlify/functions";

const model = "gemini-1.5-flash";

function safeJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 503, body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }) };

  try {
    const payload = JSON.parse(event.body || "{}");
    const prompt = [
      "You are FounderOS, an AI business command center for an e-commerce founder.",
      "Return ONLY valid JSON in the requested shape. Be concise, practical, and grounded in the supplied data.",
      "If task returns an action brief, shape is { summary: string, actions: [{ title, reason, impact, source: 'gemini' }] }.",
      "If task is reply-assistant or order-summary, return { data: string }.",
      JSON.stringify(payload).slice(0, 18000)
    ].join("\n");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      })
    });
    if (response.status === 429) return { statusCode: 429, body: JSON.stringify({ error: "quota limit" }) };
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: "Gemini API error" }) };
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = safeJson(text);
    return { statusCode: 200, body: JSON.stringify(parsed.data ? parsed : { data: parsed }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) };
  }
};
