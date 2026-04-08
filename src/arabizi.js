/**
 * Arabizi normalizer for Iraqi Arabic.
 * Converts Latin+number chat alphabet to Arabic script hints
 * before sending to the LLM. Doesn't need to be perfect —
 * the LLM handles the rest.
 */

const ARABIZI_MAP = {
  '2': '\u0621', '3': '\u0639', '5': '\u062E',
  '6': '\u0637', '7': '\u062D', '8': '\u0642', '9': '\u0635',
};
const ARABIZI_MULTI = { "3'": '\u063A', "9'": '\u0636', "6'": '\u0638' };

// Common Iraqi Arabizi words (grocery-heavy)
const IRAQI_DICT = {
  'hala': '\u0647\u0644\u0627', 'shlonk': '\u0634\u0644\u0648\u0646\u0643',
  'shlonak': '\u0634\u0644\u0648\u0646\u0643', 'shkad': '\u0634\u0643\u062F',
  'shgad': '\u0634\u0643\u062F', 'shno': '\u0634\u0646\u0648',
  'aku': '\u0627\u0643\u0648', 'maku': '\u0645\u0627\u0643\u0648',
  'zain': '\u0632\u064A\u0646', 'khosh': '\u062E\u0648\u0634',
  'yalla': '\u064A\u0644\u0627', 'wallah': '\u0648\u0627\u0644\u0644\u0647',
  'inshallah': '\u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647',
  'habibi': '\u062D\u0628\u064A\u0628\u064A',
  'habibti': '\u062D\u0628\u064A\u0628\u062A\u064A',
  'abi': '\u0623\u0628\u064A', 'abiha': '\u0623\u0628\u064A\u0647\u0627',
  'wain': '\u0648\u064A\u0646', 'tawsil': '\u062A\u0648\u0635\u064A\u0644',
  'floos': '\u0641\u0644\u0648\u0633', 'dinar': '\u062F\u064A\u0646\u0627\u0631',
  // Grocery terms
  'kilo': '\u0643\u064A\u0644\u0648', 'laham': '\u0644\u062D\u0645',
  'dijaj': '\u062F\u062C\u0627\u062C', 'ruz': '\u0631\u0632',
  'khubuz': '\u062E\u0628\u0632', 'tamata': '\u0637\u0645\u0627\u0637\u0629',
  'batata': '\u0628\u0637\u0627\u0637\u0627', 'basal': '\u0628\u0635\u0644',
  'tuffah': '\u062A\u0641\u0627\u062D', 'mawz': '\u0645\u0648\u0632',
  'halib': '\u062D\u0644\u064A\u0628', 'bayth': '\u0628\u064A\u0636',
  'sukkar': '\u0633\u0643\u0631', 'milih': '\u0645\u0644\u062D',
  'samach': '\u0633\u0645\u0643', 'chai': '\u0686\u0627\u064A',
};

function isArabicScript(text) {
  const arabic = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  return arabic / Math.max(text.length, 1) > 0.4;
}

export function normalizeArabizi(text) {
  if (isArabicScript(text)) return text;
  let n = text.toLowerCase().trim();

  // Dictionary lookup (whole words first)
  for (const [k, v] of Object.entries(IRAQI_DICT)) {
    n = n.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
  }
  // Multi-char number mappings
  for (const [k, v] of Object.entries(ARABIZI_MULTI)) n = n.replaceAll(k, v);
  // Single numbers — only when followed by a letter (not prices like "5000")
  for (const [num, ar] of Object.entries(ARABIZI_MAP)) {
    n = n.replace(new RegExp(`${num}(?=[a-zA-Z\u0600-\u06FF])`, 'g'), ar);
  }
  return n;
}
