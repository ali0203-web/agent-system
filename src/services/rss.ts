export interface RssItem {
  /** Stable identity for de-duplication: guid, else link, else title. */
  id: string
  title: string
  description: string
  link: string
  publishedAt: Date
}

/**
 * Minimal RSS 2.0 item extraction; avoids adding an XML dependency.
 * Items without a title or a valid pubDate are skipped.
 */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = []

  for (const raw of xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []) {
    const title = cleanText(extractTag(raw, 'title'))
    const description = cleanText(extractTag(raw, 'description'))
    const link = cleanText(extractTag(raw, 'link'))
    const guid = cleanText(extractTag(raw, 'guid'))
    const publishedAt = new Date(extractTag(raw, 'pubDate').trim())

    if (!title || Number.isNaN(publishedAt.getTime())) continue

    items.push({ id: guid || link || title, title, description, link, publishedAt })
  }

  return items
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return match ? match[1] : ''
}

function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&') // last, so "&amp;lt;" stays "&lt;"
    .replace(/\s+/g, ' ')
    .trim()
}
