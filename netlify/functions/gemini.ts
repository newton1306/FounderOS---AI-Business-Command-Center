import type { Handler } from "@netlify/functions";

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 25000;

function safeJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function compactPayload(payload: Record<string, unknown>) {
  const state = payload.state as { products?: Array<Record<string, unknown>>; orders?: Array<Record<string, unknown>>; simulationEvents?: unknown[] } | undefined;
  return {
    ...payload,
    product: payload.product && typeof payload.product === "object" ? { ...(payload.product as Record<string, unknown>), image: undefined } : payload.product,
    chat: payload.chat && typeof payload.chat === "object" ? {
      ...(payload.chat as Record<string, unknown>),
      messages: ((payload.chat as { messages?: unknown[] }).messages || []).slice(-6)
    } : payload.chat,
    state: state ? {
      products: (state.products || []).map((product) => ({ ...product, image: undefined })),
      orders: (state.orders || []).slice(-35),
      simulationEvents: (state.simulationEvents || []).slice(0, 8),
      lastUpdated: (state as { lastUpdated?: unknown }).lastUpdated
    } : undefined
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 503, body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }) };

  try {
    const payload = JSON.parse(event.body || "{}");
    const compact = compactPayload(payload);
    const prompt = [
      "You are FounderOS, an AI business command center for an e-commerce founder.",
      "Return ONLY valid JSON in the requested shape. Be concise, practical, and grounded in the supplied data.",
      "If task returns an action brief, shape is { summary: string, actions: [{ title, reason, impact, source: 'gemini' }] }.",
      "If task is reply-assistant or order-summary, return { data: string }.",
      JSON.stringify(compact).slice(0, 10000)
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: "application/json" }
      })
    }).finally(() => clearTimeout(timeout));
    if (response.status === 429) return { statusCode: 429, body: JSON.stringify({ error: "quota limit" }) };
    if (!response.ok) {
      const detail = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: "Gemini API error", model, detail: detail.slice(0, 500) }) };
    }
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = safeJson(text);
    return { statusCode: 200, body: JSON.stringify(parsed.data ? parsed : { data: parsed }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) };
  }
};
