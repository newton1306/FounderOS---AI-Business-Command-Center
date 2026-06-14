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
