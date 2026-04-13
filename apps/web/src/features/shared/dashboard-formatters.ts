export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return `${seconds}s ago`;
}

export function formatDateForFile(timestamp: number) {
  return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}
