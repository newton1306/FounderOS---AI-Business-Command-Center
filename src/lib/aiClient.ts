import { founderBriefFallback, orderSummaryFallback, productInsightFallback, replyFallback, reviewPainFallback } from "./fallbackAi";
import { getFallbackUntil, getJson, setFallbackCooldown, setJson } from "./storage";
import type { ActionBrief, AiMode, BusinessState, Chat, Order, Product } from "./types";

const TIMEOUT_MS = 12000;

export interface AiResult<T> {
  mode: AiMode;
  reason: string;
  data: T;
}

async function callGemini<T>(payload: Record<string, unknown>, fallback: () => T, cacheKey?: string): Promise<AiResult<T>> {
  if (!navigator.onLine) {
    const cached = cacheKey ? getJson<T | null>(cacheKey, null) : null;
    return { mode: cached ? "cached" : "offline", reason: cached ? "offline cached result" : "offline local fallback", data: cached || fallback() };
  }
  if (Date.now() < getFallbackUntil()) {
    return { mode: "fallback", reason: "fallback cooldown active", data: fallback() };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    window.clearTimeout(timeout);
    if (response.status === 429) {
      setFallbackCooldown(15);
      return { mode: "fallback", reason: "quota limit", data: fallback() };
    }
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { error?: string; model?: string } | null;
      const reason = error?.model ? `${error.error || "API error"} (${error.model})` : error?.error || "API error";
      return { mode: "fallback", reason, data: fallback() };
    }
    const json = (await response.json()) as { data?: T };
    if (!json.data) return { mode: "fallback", reason: "empty API result", data: fallback() };
    if (cacheKey) setJson(cacheKey, json.data);
    return { mode: "live", reason: "Gemini response", data: json.data };
  } catch (error) {
    window.clearTimeout(timeout);
    const reason = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "API error";
    return { mode: "fallback", reason, data: fallback() };
  }
}

export function getFounderBrief(state: BusinessState) {
  return callGemini<ActionBrief>(
    { task: "founder-brief", state },
    () => founderBriefFallback(state),
    "ai_founder_brief_cache"
  );
}

export function getProductInsight(product: Product, state: BusinessState) {
  return callGemini<ActionBrief>(
    { task: "product-insight", product, state },
    () => productInsightFallback(product, state),
    `ai_product_${product.product_id}_cache`
  );
}

export function getReviewPainSummary(state: BusinessState) {
  return callGemini<ActionBrief>(
    { task: "review-pain", state },
    () => reviewPainFallback(state),
    "ai_review_pain_cache"
  );
}

export function getReply(chat: Chat) {
  return callGemini<string>(
    { task: "reply-assistant", chat },
    () => replyFallback(chat),
    `ai_reply_${chat.chat_id}_cache`
  );
}

export function getOrderSummary(order: Order, state: BusinessState) {
  return callGemini<string>(
    { task: "order-summary", order, state },
    () => orderSummaryFallback(order, state),
    `ai_order_${order.order_id}_cache`
  );
}
