/**
 * Formats a timestamp as a compact relative time string for notification UI.
 * Mirrors the zh inline pattern.
 */
export function formatRelativeTime(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  const isChinese = lang.startsWith('zh')

  if (minutes < 1) {
    if (isChinese) return '剛剛'
    return 'just now'
  }
  if (minutes < 60) {
    if (isChinese) return `${minutes}分鐘`
    return `${minutes}m`
  }
  if (hours < 24) {
    if (isChinese) return `${hours}小時`
    return `${hours}h`
  }
  if (days < 30) {
    if (isChinese) return `${days}天`
    return `${days}d`
  }
  return new Date(dateStr).toLocaleDateString()
}
