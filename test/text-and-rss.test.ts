/**
 * Unit tests for the shared text matcher and RSS parser.
 * The matcher cases are real headlines on which plain substring matching misfired.
 */

import { containsTerm, findTerms } from '../src/services/text-match'
import { parseRss } from '../src/services/rss'

describe('containsTerm', () => {
  test.each([
    ['Singapore Gulf Bank adds settlement', 'ban'],
    ['Community banks sue OCC', 'ban'],
    ['Banking Group Sues to Block Crypto', 'ban'],
    ["'Uptober' Off With a Bang as Bitcoin Surges", 'ban'],
    ["MetaMask Exits Lido Validators Amid 'Security Incident'", 'sec'],
    ['Moonbeam launches a hackathon', 'moon'],
    ['Moonbeam launches a hackathon', 'hack'],
    ['Canada approves a new rule', 'ADA'],
  ])('does not match %j for %j (mid-word)', (text, term) => {
    expect(containsTerm(text, term, term === 'ADA' ? { caseSensitive: true, inflect: false } : {})).toBe(false)
  })

  test.each([
    ['Bitcoin surges past $90K', 'surge'],
    ['Exchange hacked for $40M', 'hack'],
    ['A hacker drained the pool', 'hack'],
    ['NEAR recovers funds from exploiter', 'exploit'],
    ['New bans on crypto ads', 'ban'],
    ['SEC delays ETF decision', 'sec'],
    ["SEC's new rule", 'sec'],
    ['Regulations tighten in the EU', 'regulation'],
    ['Bitcoin hits an all-time high', 'all-time high'],
  ])('matches %j for %j (whole word or simple ending)', (text, term) => {
    expect(containsTerm(text, term)).toBe(true)
  })

  test('forms that are not plain endings must be listed explicitly', () => {
    expect(containsTerm('Regulators banned the token', 'ban')).toBe(false)
    expect(containsTerm('Regulators banned the token', 'banned')).toBe(true)
    expect(containsTerm('Altcoins rallied overnight', 'rally')).toBe(false)
    expect(containsTerm('Altcoins rallied overnight', 'rallied')).toBe(true)
  })

  test('tickers can be matched case-sensitively without endings', () => {
    const opts = { caseSensitive: true, inflect: false }
    expect(containsTerm('SOL jumps 8%', 'SOL', opts)).toBe(true)
    expect(containsTerm('A solution for scaling', 'SOL', opts)).toBe(false)
    expect(containsTerm('sol jumps', 'SOL', opts)).toBe(false)
  })

  test('matching is case-insensitive by default', () => {
    expect(containsTerm('BITCOIN SURGES', 'bitcoin')).toBe(true)
  })

  test('terms containing regex characters are treated literally', () => {
    expect(() => containsTerm('x', 'a+b*')).not.toThrow()
    expect(containsTerm('so x+1 holds', 'x+1')).toBe(true) // "+" is literal, not a quantifier
  })
})

describe('findTerms', () => {
  test('returns only the terms present', () => {
    expect(findTerms('Bitcoin surges as ETF approval nears', ['surge', 'approval', 'crash'])).toEqual([
      'surge',
      'approval',
    ])
  })
})

describe('parseRss', () => {
  const feed = `<?xml version="1.0"?><rss><channel>
    <item>
      <title><![CDATA[Bitcoin &amp; Ether rally]]></title>
      <description><![CDATA[<p>Markets <b>jump</b> &amp;lt;today&amp;gt;</p>]]></description>
      <link><![CDATA[https://example.com/a?utm_source=rss]]></link>
      <guid isPermaLink="true">https://example.com/a</guid>
      <pubDate>Sat, 03 Oct 2026 07:06:08 +0000</pubDate>
    </item>
    <item>
      <title>No guid story</title>
      <description>plain</description>
      <link>https://example.com/b</link>
      <pubDate>Sat, 03 Oct 2026 08:00:00 +0000</pubDate>
    </item>
    <item><title>Bad date</title><pubDate>not a date</pubDate></item>
    <item><title></title><pubDate>Sat, 03 Oct 2026 08:00:00 +0000</pubDate></item>
  </channel></rss>`

  test('extracts items, cleans text and decodes entities', () => {
    const [first] = parseRss(feed)
    expect(first.title).toBe('Bitcoin & Ether rally')
    expect(first.description).toBe('Markets jump &lt;today&gt;') // "&amp;lt;" is decoded once, not twice
    expect(first.link).toBe('https://example.com/a?utm_source=rss')
    expect(first.publishedAt.toISOString()).toBe('2026-10-03T07:06:08.000Z')
  })

  test('uses guid, then link, then title as the stable id', () => {
    const items = parseRss(feed)
    expect(items[0].id).toBe('https://example.com/a')
    expect(items[1].id).toBe('https://example.com/b')
  })

  test('skips items with no title or an invalid date', () => {
    expect(parseRss(feed)).toHaveLength(2)
  })

  test('returns [] for non-RSS input', () => {
    expect(parseRss('<html><body>Service unavailable</body></html>')).toEqual([])
    expect(parseRss('')).toEqual([])
  })
})
