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

function taskInstruction(task: unknown) {
  if (task === "founder-brief") {
    return [
      "Task: founder-brief.",
      "Write one specific summary sentence about revenue, stock, orders, reviews, and chats.",
      "Return exactly 3 actions: one inventory/revenue action, one order/customer follow-up action, and one review/chat trust action.",
      "Each action needs a concrete title, a data-grounded reason, and a business impact."
    ].join(" ");
  }
  if (task === "product-insight") {
    return [
      "Task: product-insight.",
      "Write one specific summary sentence for the selected product.",
      "Return exactly 3 actions: one stock/demand action, one review or conversion action, and one merchandising action.",
      "Each action must reference the supplied product or related state."
    ].join(" ");
  }
  if (task === "review-pain") {
    return [
      "Task: review-pain.",
      "Write one specific summary sentence about negative review themes.",
      "Return exactly 3 actions: one review reply action, one product issue tagging action, and one FAQ/support prevention action.",
      "Ground every reason in supplied reviews, products, or chats."
    ].join(" ");
  }
  if (task === "reply-assistant") {
    return "Task: reply-assistant. Return one polite Thai shop reply in data. Use the latest USER message and do not invent order data.";
  }
  if (task === "order-summary") {
    return "Task: order-summary. Return one concise operational English order summary in data. Include customer, status, items, value, and risk.";
  }
  return "Task: unknown. Follow the requested schema exactly.";
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
    throw new Error("Gemini returned malformed action brief JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParsedResult(parsed: unknown, task: unknown) {
  if (task === "reply-assistant" || task === "order-summary") {
    if (!isRecord(parsed)) throw new Error("Gemini returned an invalid text result");
    const data = textValue(parsed.data);
    if (!data) throw new Error("Gemini returned an empty text result");
    return { data };
  }

  const brief = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : parsed;
  if (!isRecord(brief)) throw new Error("Gemini returned an invalid action brief");
  const summary = textValue(brief.summary);
  const rawActions = Array.isArray(brief.actions) ? brief.actions : [];
  const actions = rawActions
    .filter(isRecord)
    .map((action) => ({
      title: textValue(action.title),
      reason: textValue(action.reason),
      impact: textValue(action.impact),
      source: "gemini"
    }))
    .filter((action) => action.title && action.reason && action.impact)
    .slice(0, 3);

  if (!summary || actions.length < 3) {
    throw new Error("Gemini action brief was incomplete");
  }
  return { data: { summary, actions } };
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
      "Action brief tasks must return exactly 3 complete actions. Do not return a single paragraph, markdown, bullets outside JSON, or a partial envelope.",
      "If task is reply-assistant or order-summary, return { data: string }.",
      taskInstruction(payload.task),
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
    return { statusCode: 200, body: JSON.stringify(normalizeParsedResult(parsed, payload.task)) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) };
  }
};
