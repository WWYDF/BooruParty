export function formatStorageFromMB(mb: number): string {
  if (mb >= 1024 * 1024) {
    return `${(mb / 1024 / 1024).toFixed(2)} TB`;
  } else if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  } else {
    return `${mb.toFixed(0)} MB`;
  }
}

export function formatStorageFromBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) {
    return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  } else if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  } else if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}
