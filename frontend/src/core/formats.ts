export function formatStorage(mb: number): string {
  if (mb >= 1024 * 1024) {
    return `${(mb / 1024 / 1024).toFixed(2)} TB`;
  } else if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  } else {
    return `${mb.toFixed(0)} MB`;
  }
}
