/** Fallback measure when the API did not send one. Mirrors app/measure_level.py. */

const RATING_WORDS = [
  'agree',
  'disagree',
  'neither',
  'somewhat',
  'likely',
  'unlikely',
  'satisfied',
  'dissatisfied',
  'satisfaction',
  'likelihood',
  'trust',
  'distrust',
  'poor',
  'fair',
  'good',
  'excellent',
  'important',
  'unimportant',
];
const INTENSITY_WORDS = [
  'never',
  'rarely',
  'seldom',
  'occasionally',
  'sometimes',
  'often',
  'always',
  'frequent',
  'infrequent',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'annually',
  'constantly',
  'hardly',
  'once',
  'twice',
];
const RANK_WORDS = new Set([
  'junior',
  'senior',
  'mid',
  'midlevel',
  'associate',
  'director',
  'manager',
  'intern',
  'entry',
  'principal',
  'lead',
  'executive',
  'trainee',
  'graduate',
  'partner',
  'owner',
  'founder',
  'head',
  'vp',
  'clevel',
  'low',
  'medium',
  'high',
  'lowest',
  'highest',
  'small',
  'large',
  'smallest',
  'largest',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'primary',
  'secondary',
  'tertiary',
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'mild',
  'moderate',
  'severe',
  'worse',
  'better',
  'worst',
  'best',
]);
const LIKERT_ABBREV = new Set(['sd', 'd', 'n', 'a', 'sa', 'vd', 'va']);

function labelTokens(text: string): Set<string> {
  const folded = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ');
  return new Set(folded.match(/[a-z0-9]+/g) || []);
}

function orderedValueLabels(labels: Record<string, string>): boolean {
  const entries = Object.entries(labels);
  if (entries.length < 3) return false;
  let ratingHits = 0;
  let abbrevHits = 0;
  let rankHits = 0;
  let numbered = 0;
  for (const [key, text] of entries) {
    const folded = String(text || '')
      .trim()
      .toLowerCase();
    if (LIKERT_ABBREV.has(folded)) abbrevHits += 1;
    if (RATING_WORDS.some(word => folded.includes(word))) ratingHits += 1;
    else if (INTENSITY_WORDS.some(word => folded.includes(word))) ratingHits += 1;
    const tokens = labelTokens(text);
    for (const word of RANK_WORDS) {
      if (tokens.has(word)) {
        rankHits += 1;
        break;
      }
    }
    const code = Number(String(key).replace(/\.0$/, ''));
    if (!Number.isInteger(code)) return false;
    const numbers = (String(text).match(/\d+/g) || []).map(part => Number(part));
    const bare = String(text).trim();
    if (numbers.includes(code) || bare === String(code) || bare === `${code}.0`) {
      numbered += 1;
    }
  }
  if (ratingHits >= 3 || abbrevHits >= 4) return true;
  if (rankHits >= 2) return true;
  return numbered === entries.length;
}

/** Ordinal only when codes are an integer run and labels read as ordered. */
export function labelledMeasure(labels: Record<string, string>): 'ordinal' | 'nominal' {
  const codes = Object.keys(labels)
    .map(key => Number(String(key).replace(/\.0$/, '')))
    .filter(value => Number.isInteger(value));
  if (codes.length !== Object.keys(labels).length || codes.length < 3) return 'nominal';
  const unique = [...new Set(codes)].sort((a, b) => a - b);
  if (unique.length < 3) return 'nominal';
  const missing = unique[unique.length - 1] - unique[0] + 1 - unique.length;
  if (missing > 1) return 'nominal';
  return orderedValueLabels(labels) ? 'ordinal' : 'nominal';
}
