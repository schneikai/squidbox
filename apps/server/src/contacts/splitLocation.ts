// From link's place: the location an X profile shows as one line ("Bogotá, D.C., Colombia", "Denver,
// CO"), split into a contact place's city, state and country by its commas, with the country's
// official English name.

const US = 'United States';

const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

// Names a country goes by besides its official English one, lowercased.
const COUNTRY_ALIASES: Record<string, string> = {
  usa: US,
  us: US,
  'u.s.': US,
  'u.s.a.': US,
  'united states of america': US,
  america: US,
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'northern ireland': 'United Kingdom',
};

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

// Every country's official English name, by its lowercased name (Intl's region names).
const COUNTRIES: Map<string, string> = (() => {
  const names = REGION_NAMES;
  const map = new Map<string, string>();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of letters)
    for (const b of letters) {
      const code = a + b;
      const name = names.of(code);
      // An unknown code comes back as itself.
      if (name && name !== code) map.set(name.toLowerCase(), name);
    }
  for (const [alias, name] of Object.entries(COUNTRY_ALIASES)) map.set(alias, name);
  return map;
})();

const STATE_NAMES = new Map(Object.values(US_STATES).map((name) => [name.toLowerCase(), name]));

function country(part: string): string | undefined {
  return COUNTRIES.get(part.toLowerCase());
}

// A US state by its name or its two letters (as "Denver, CO" writes it).
function usState(part: string): string | undefined {
  return STATE_NAMES.get(part.toLowerCase()) ?? US_STATES[part.toUpperCase().replace(/\./g, '')];
}

// A flag emoji: two regional indicator letters, 🇨🇦 for CA.
const FLAG = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const REGIONAL_A = 0x1f1e6;

// The country of the first flag in `text` ("East coast 🇨🇦" → Canada), if any.
function flagCountry(text: string): string | undefined {
  const flag = text.match(FLAG)?.[0];
  if (!flag) return undefined;
  const code = [...flag].map((letter) => String.fromCharCode(letter.codePointAt(0)! - REGIONAL_A + 65)).join('');
  const name = REGION_NAMES.of(code);
  return name && name !== code ? name : undefined;
}

// A part that ends with a country's name after a space ("East Coast Canada"), as the part before it
// and the country; the longest name that fits wins ("Papua New Guinea" over "Guinea").
function splitTrailingCountry(part: string): [string, string] | undefined {
  const lower = part.toLowerCase();
  let best: [string, string] | undefined;
  for (const [name, official] of COUNTRIES) {
    if (lower.endsWith(` ${name}`) && (!best || name.length > best[1].length)) {
      best = [part.slice(0, part.length - name.length).trim(), name];
    }
  }
  return best && [best[0], COUNTRIES.get(best[1])!];
}

export type SplitLocation = { city: string; state: string; country: string };

/**
 * `location` as a place: "City, Country", "City, State, Country" (anything between the first and the
 * last part is the state) or "City, ST" in the US, the country by its official English name; one part
 * is a country, a US state or else the city. A last part that is no country stays the state
 * ("Squamish, BC"), unless it ends with one ("East Coast Canada": East Coast, Canada). Without a
 * country named, a flag gives it ("Toronto 🇨🇦"). Empty for an empty location.
 */
export function splitLocation(location: string): SplitLocation {
  const place = splitParts(location.replace(FLAG, ' '));
  return place.country ? place : { ...place, country: flagCountry(location) ?? '' };
}

function splitParts(location: string): SplitLocation {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const tail = parts.length > 0 && !country(parts.at(-1)!) && !usState(parts.at(-1)!) && splitTrailingCountry(parts.at(-1)!);
  if (tail) parts.splice(-1, 1, ...tail.filter(Boolean));
  const empty = { city: '', state: '', country: '' };
  if (parts.length === 0) return empty;
  const last = parts[parts.length - 1]!;
  const lastCountry = country(last);
  const lastState = lastCountry ? undefined : usState(last);
  if (parts.length === 1) {
    if (lastCountry) return { ...empty, country: lastCountry };
    if (lastState) return { ...empty, state: lastState, country: US };
    return { ...empty, city: last };
  }
  const city = parts[0]!;
  if (lastState && parts.length === 2) return { city, state: lastState, country: US };
  if (!lastCountry) return { city, state: parts.slice(1).join(', '), country: '' };
  const middle = parts.slice(1, -1).join(', ');
  return { city, state: lastCountry === US ? (usState(middle) ?? middle) : middle, country: lastCountry };
}
