// Endings a keyword may take and still count as that keyword: "hack" matches
// hack, hacks, hacked, hacker; "surge" matches surges, surged.
const ENDINGS = '(?:s|es|ed|d|ing|er|ers)?'

export interface MatchOptions {
  /** Default false. Tickers like "SOL" should be matched case-sensitively. */
  caseSensitive?: boolean
  /** Default true. Allow plural / past-tense endings after the term. */
  inflect?: boolean
}

/**
 * True when `term` appears in `text` as a whole word (or phrase).
 *
 * Plain substring matching misfires on real headlines: "ban" is found in
 * "Bank", "Banking" and "Bang", and "sec" in "Security". Matching word
 * boundaries removes those. Inflections that are not simple endings
 * ("rallies", "banned") need to be listed as their own terms.
 */
export function containsTerm(text: string, term: string, options: MatchOptions = {}): boolean {
  const { caseSensitive = false, inflect = true } = options
  const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const pattern = `\\b${escaped}${inflect ? ENDINGS : ''}\\b`
  return new RegExp(pattern, caseSensitive ? '' : 'i').test(text)
}

/** The subset of `terms` found in `text`. */
export function findTerms(text: string, terms: string[], options: MatchOptions = {}): string[] {
  return terms.filter((term) => containsTerm(text, term, options))
}
