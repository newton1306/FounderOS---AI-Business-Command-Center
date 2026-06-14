export function getJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFallbackUntil() {
  return Number(localStorage.getItem("ai_fallback_until") || "0");
}

export function setFallbackCooldown(minutes = 10) {
  const until = Date.now() + minutes * 60 * 1000;
  localStorage.setItem("ai_fallback_until", String(until));
  return until;
}

export function clearFallbackCooldown() {
  localStorage.removeItem("ai_fallback_until");
}
