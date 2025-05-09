export function parseSearch(input: string) {
  const terms = input.split(/\s+/).filter(Boolean);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  const systemOptions: Record<string, string> = {};

  for (const term of terms) {
    if (term.startsWith("-")) {
      excludeTags.push(term.substring(1));
    } else if (term.includes(":")) {
      const [key, value] = term.split(":");
      if (key && value) {
        systemOptions[key] = value;
      }
    } else {
      includeTags.push(term);
    }
  }

  const typeMatches = [...input.matchAll(/(-)?type:([^\s]+)/g)];
  const includeTypes: string[] = [];
  const excludeTypes: string[] = [];

  for (const [, isNegated, val] of typeMatches) {
    const lower = val.toLowerCase();
    if (isNegated) excludeTypes.push(lower);
    else includeTypes.push(lower);
  }

  return { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions };
}