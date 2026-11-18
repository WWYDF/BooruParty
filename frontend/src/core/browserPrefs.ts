// Per-browser preferences in localStorage ("browserPreferences", also written by the Preferences page).
// Writes go through here so open components can react without a reload.

const STORAGE_KEY = "browserPreferences";
export const PREFS_EVENT = "bp:prefs"; // fired on window after every write

function readAll(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function readBrowserPref<T>(key: string, fallback: T): T {
  const value = readAll()[key];
  return value === undefined ? fallback : (value as T);
}

export function writeBrowserPref(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [key]: value }));
  } catch {
    // storage blocked or full: the change just won't persist
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
