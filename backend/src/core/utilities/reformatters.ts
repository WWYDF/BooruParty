// Functions that take in objects and replace specific parts (idk bro just look at it smh)

// Strip any trailing slash so we never end up with "//data/..."
const PUBLIC_URL = (process.env.BACKEND_URL ?? '').replace(/\/+$/, '');

export function withAssetUrls<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj };

  for (const key of keys) {
    const value = out[key];
    if (typeof value === 'string') {
      out[key] = `${PUBLIC_URL}${value}` as T[typeof key];
    }
  }

  return out;
}