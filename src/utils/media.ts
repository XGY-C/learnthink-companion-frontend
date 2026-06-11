/**
 * Extract video URL from a resource object.
 * Checks direct videoUrl property, then parses content/brief/deepContent
 * as JSON or via regex fallback for broken JSON.
 */
export function extractVideoUrl(res: any): string | null {
  const raw = res.videoUrl || res.content || res.deepContent || res.brief || ''
  if (!raw) return null
  if (typeof raw === 'string' && /^https?:\/\//.test(raw.trim())) return raw.trim()
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  try {
    const parsed = JSON.parse(text)
    if (parsed?.videoUrl) return parsed.videoUrl
  } catch { /* JSON broken, fall through to regex */ }
  const m = text.match(/"videoUrl"\s*:\s*(https?:\/\/[^"]+)/)
  return m ? m[1] : null
}
