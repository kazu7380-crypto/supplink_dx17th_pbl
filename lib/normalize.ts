export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
}

export function matches(query: string, ...fields: string[]): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.map(normalize).join(" ");
  return tokens.every((t) => haystack.includes(t));
}
