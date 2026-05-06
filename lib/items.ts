import type { Item } from "./types";

export const items: Item[] = [
  { code: 1,  name: "シリンジ",       spec: "50ml,横口,スリップ",         shelf: "棚M5③",  memo: "細いの" },
  { code: 2,  name: "シリンジ",       spec: "50ml,ロック",                shelf: "棚M3③",  memo: "いっぱい使うやつ" },
  { code: 3,  name: "シリンジ",       spec: "10ml,横口,スリップ",         shelf: "棚M66①", memo: "外科" },
  { code: 4,  name: "シリンジ",       spec: "5ml,スリップ,赤",            shelf: "棚M6①",  memo: "赤いやつ" },
  { code: 5,  name: "シリンジ",       spec: "10ml,中口,スリップ",         shelf: "棚M5②",  memo: "よく出る先が細いの" },
  { code: 6,  name: "シリンジ",       spec: "30ml,ロック",                shelf: "棚M7①",  memo: "耳鼻科" },
  { code: 7,  name: "シリンジ",       spec: "10ml,横口,スリップ,緑",      shelf: "棚M56②", memo: "緑ぽいの" },
  { code: 8,  name: "シリンジ",       spec: "2.5ml,ロック",               shelf: "棚M8①",  memo: "小さいの" },
  { code: 9,  name: "シリンジ",       spec: "20ml,ロック",                shelf: "棚M89③", memo: "うさぎ" },
  { code: 10, name: "シリンジ",       spec: "20ml,ロック",                shelf: "棚M5③",  memo: "" },
  { code: 11, name: "シリンジ",       spec: "30ml,横口,スリップ",         shelf: "棚M47③", memo: "" },
  { code: 12, name: "シリンジ",       spec: "30ml,横口,スリップ,赤",      shelf: "棚M9③",  memo: "" },
  { code: 13, name: "Yカットガーゼ",  spec: "7.5x10cm,8ply",              shelf: "大棚L41⑥", memo: "" },
  { code: 14, name: "ターボガーゼX",  spec: "3x30cm,ズラシ2折;5枚入",    shelf: "大棚L45⑥", memo: "" },
  { code: 15, name: "ガーゼXi",       spec: "No.2,30x30cm,4折;10枚入",   shelf: "大棚G1③",  memo: "大きいの" },
  { code: 16, name: "特殊ガーゼ",     spec: "3cm;5個入",                  shelf: "大棚D33③", memo: "特殊B" },
  { code: 17, name: "特殊ガーゼ",     spec: "5cm;5個入",                  shelf: "大棚D24③", memo: "特殊A" },
  { code: 18, name: "ガーゼC",        spec: "25x25cm,4折;",               shelf: "大棚D25③", memo: "４つ折り" },
  { code: 19, name: "Mガーゼ",        spec: "30x30cm,2折,10枚合半折",     shelf: "大棚G16①", memo: "" },
];

export function findItem(code: number): Item | undefined {
  return items.find((i) => i.code === code);
}
