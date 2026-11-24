// PostRelation stores each pair once, lower id first. Every read/write goes through this
export function relationPair(a: number, b: number) {
  return a < b ? { fromId: a, toId: b } : { fromId: b, toId: a };
}
