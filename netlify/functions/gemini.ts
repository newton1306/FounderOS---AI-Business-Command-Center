import type { Handler } from "@netlify/functions";

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 25000;

function safeJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
  try {
    return JSON.parse(jsonText);
  } catch {
    return JSON.parse(repairJsonText(jsonText));
  }
}

function repairJsonText(text: string) {
  let inString = false;
  let escaped = false;
  let repaired = "";
  for (const char of text) {
    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      repaired += char;
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      repaired += char;
      continue;
    }
    if (inString && char === "\n") {
      repaired += "\\n";
      continue;
    }
    if (inString && char === "\r") continue;
    repaired += char;
  }
  return repaired.replace(/,\s*([}\]])/g, "$1");
}

function getResponseSchema(task: unknown) {
  if (task === "reply-assistant" || task === "order-summary") {
    return {
      type: "OBJECT",
      properties: { data: { type: "STRING" } },
      required: ["data"]
    };
  }
  return {
    type: "OBJECT",
    properties: {
      summary: { type: "STRING" },
      actions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            reason: { type: "STRING" },
            impact: { type: "STRING" },
            source: { type: "STRING" }
          },
          required: ["title", "reason", "impact", "source"]
        }
      }
    },
    required: ["summary", "actions"]
  };
}

function normalizeText(text: string) {
  const cleaned = text
    .replace(/```json|```/g, "")
    .replace(/^\s*\{?|\}?\s*$/g, "")
    .replace(/"\s*[,}]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned
    .replace(/^"(data|summary|reason|impact)"\s*:\s*"?/i, "")
    .replace(/",?\s*"(actions|source|title)"\s*:.+$/i, "")
    .trim();
}

function parsedOrGeminiText(text: string, task: unknown) {
  try {
    return safeJson(text);
  } catch {
    const content = normalizeText(text) || "Gemini returned a recommendation, but the JSON envelope was malformed.";
    if (task === "reply-assistant" || task === "order-summary") {
      return { data: content };
    }
    return {
      summary: content.slice(0, 280),
      actions: [
        {
          title: "Review Gemini suggestion",
          reason: content,
          impact: "This is a live Gemini response recovered from a malformed JSON envelope.",
          source: "gemini"
        }
      ]
    };
  }
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
      "Do not put raw line breaks inside string values. Use plain one-line strings.",
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
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
          responseSchema: getResponseSchema(payload.task)
        }
      })
    }).finally(() => clearTimeout(timeout));
    if (response.status === 429) return { statusCode: 429, body: JSON.stringify({ error: "quota limit" }) };
    if (!response.ok) {
      const detail = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: "Gemini API error", model, detail: detail.slice(0, 500) }) };
    }
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = parsedOrGeminiText(text, payload.task);
    return { statusCode: 200, body: JSON.stringify(parsed.data ? parsed : { data: parsed }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) };
  }
};
