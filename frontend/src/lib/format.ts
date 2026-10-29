/** Backend timestamps are naive UTC; treat them as UTC before formatting. */
export function parseApiDate(iso: string) {
  return new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function formatRelative(iso?: string | null) {
  if (!iso) return 'Never';
  const date = parseApiDate(iso);
  const diff = Date.now() - date.getTime();
  const day = 86_400_000;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  return parseApiDate(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
