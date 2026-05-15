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
  // 物品名・仕様等の元データに含まれる空白を検索時に無視する。
  // 例: 元データ "PDS Z77" に対して、クエリ "pdsz77" / "pds z77" / "PDS Z77" の
  //     どれを入れてもヒットする。空白区切りクエリの AND 検索挙動も維持。
  const haystack = fields.map(normalize).join(" ").replace(/\s+/g, "");
  return tokens.every((t) => haystack.includes(t));
}
