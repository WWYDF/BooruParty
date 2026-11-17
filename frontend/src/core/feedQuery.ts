// The feed's search string (q), shared by the feed and the post page's navigator,
// so Next/Previous step through exactly the search the user came from.

// Safety buttons become a `safety:` term in the search, unless the user already typed one
export function buildQuery(text: string, safeties: string[]) {
  const q = text.trim();
  if (safeties.length === 0 || /(^|\s)-?safety:/i.test(q)) return q;
  return `${q} safety:${safeties.join(",").toLowerCase()}`.trim();
}

// The q of the last feed search (PostsPage saves { query, safety } in sessionStorage). "" = default feed.
export function lastFeedQuery(): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem("lastSearchParams") ?? "{}");
    const text: string = saved.query ?? "";
    const safeties: string[] = (saved.safety ?? "").split("-").filter(Boolean);
    return buildQuery(text, safeties);
  } catch {
    return "";
  }
}
