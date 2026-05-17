// ── Smart raw-text parser for booking creation ─────────────────────────────
// Version 2 — Intelligent name / address disambiguation
//
// Handles all of these WhatsApp formats:
//   1. Plain lines:   "Nikhil Mahato\n9304567655\nIris Tech Park"
//   2. Labeled:       "Name: Nikhil\nPhone: 9304...\nPG: Green View"
//   3. Sentence:      "My name is Nikhil, please book at Green View PG"
//   4. Mixed/messy:   emoji, noise, partial labels, room-only numbers

export interface ParsedBookingFields {
  user_name:                      string;
  user_phone:                     string;
  address:                        string;
  live_location_url:              string;
  branch:                         string;
  booking_via:                    string;
  booking_created_date_and_time:  string;
}

// ── Noise — lines that contain zero useful data ────────────────────────────

const NOISE_PATTERNS: RegExp[] = [
  /^hi\s*$/i, /^hey\s*$/i, /^ok\s*$/i, /^okay\s*$/i, /^yes\s*$/i,
  /Succesly/i, /catalogue/i, /wa\.me/i, /preferred timing/i,
  /choose your/i, /availability/i, /\bthank\b/i, /\bregards\b/i,
  /booking\s*request/i, /dear\s+sir/i, /dear\s+madam/i,
];

// ── Location vocabulary — if a line contains these, it's likely an address ─

const LOCATION_KW = new Set([
  // Structural
  'pg','hostel','flat','room','floor','wing','apartment','house','villa',
  'building','tower','block','society','complex','residency','enclave',
  'heights','garden','colony','nagar','layout','extension','phase','sector',
  // Directional / landmark
  'near','opposite','behind','beside','above','below','chowk','bazaar',
  'gali','mohalla','main','cross','bypass','highway','road','street',
  'lane','avenue','market','mall','plaza','hub','industrial','commercial',
  // Nature / colour words often used in PG names
  'park','view','green','blue','royal','golden','silver','diamond','star',
  'elite','premier','classic','heritage','modern','iris','lotus','tulip',
  'orchid','rose','sunshine','sunrise','sunset','sky','river','hill',
  'valley','valley','grand',
  // Infrastructure
  'railway','airport','stadium','hospital','university','college','school',
  'temple','church','mosque','gurudwara','metro',
  // Cities / areas (Punjab focus)
  'jalandhar','chandigarh','ludhiana','amritsar','patiala','bathinda',
  'mohali','zirakpur','kharar','phagwara','hoshiarpur','gurdaspur',
  'delhi','mumbai','bangalore','pune','hyderabad','chennai','kolkata',
  // Tech-park words
  'tech','it','hub','park',
]);

// ── Stop-words that can appear in lines but disqualify them as names ────────

const NAME_STOP_WORDS = new Set([
  'here','there','this','that','these','those','want','need','require',
  'looking','book','booking','room','flat','available','urgent','asap',
  'please','sir','madam','bhai','didi','ji',
]);

// ── Labeled field extractors ───────────────────────────────────────────────

type LabelKey = 'name' | 'pgName' | 'room' | 'contact' | 'liveLocation';

const LABEL_RE: Record<LabelKey, RegExp> = {
  name:         /(?:customer\s*name|client\s*name|tenant(?:\s*name)?|booking\s*(?:for|name)|name)\s*[:\-–]\s*([^\n,]{2,40})/i,
  pgName:       /(?:building\s*\/?\s*pg\s*name|pg\s*name|building\s*name|building|address|location|pg)\s*[:\-–]\s*([^\n]{3,})/i,
  room:         /(?:room\s*(?:number|no\.?|#?)|flat\s*(?:no\.?|number)?|unit\s*(?:no\.?|#)?)\s*[:\-–]\s*(\w+)/i,
  contact:      /(?:contact\s*(?:number|no\.?)|mobile\s*(?:no\.?|number)?|phone\s*(?:no\.?)?|mob|ph)\s*[:\-–]\s*([^\n]{7,})/i,
  liveLocation: /(?:live\s*location|location\s*url|google\s*maps?|maps)\s*[:\-–]\s*([^\n]+)/i,
};

// ── Sentence patterns — extract name from natural-language sentences ────────

const SENTENCE_NAME_RE: RegExp[] = [
  /\bmy\s+name\s+is\s+([A-Za-z][a-z]{1,}(?:\s+[A-Za-z][a-z]{1,}){0,3})/i,
  /\bi(?:'m|\s+am)\s+([A-Za-z][a-z]{1,}(?:\s+[A-Za-z][a-z]{1,}){0,3})/i,
  /\bfor\s+((?:[A-Z][a-z]{1,}\s*){2,3})\b/,         // "booking for Nikhil Kumar"
  /\bMr\.?\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,2})/,
  /\bMrs\.?\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,2})/,
  /\bMs\.?\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,2})/,
];

// ── Regex shortcuts ────────────────────────────────────────────────────────

const PHONE_RE_LOOSE  = /(?:\+91|91)?([6-9]\d{9})\b/;
const URL_RE          = /https?:\/\/[^\s,\n]+/;
const ROOM_ONLY_RE    = /^\d{1,5}$/;
const EMOJI_RE        = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

// ── Helpers ────────────────────────────────────────────────────────────────

function strip(s: string): string {
  return s.replace(EMOJI_RE, "").trim();
}

function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function extractLabeled(text: string, key: LabelKey): string {
  const m = text.match(LABEL_RE[key]);
  if (!m?.[1]) return "";
  const val = strip(m[1]).trim();
  if (!val || /please\s*share/i.test(val) || val === "(here)") return "";
  return val;
}

function phoneFromText(text: string): string {
  const m = text.match(PHONE_RE_LOOSE);
  return m ? "+91" + m[1] : "";
}

function hasLocationKw(line: string): boolean {
  return line.toLowerCase().split(/[\s,\-\/.()]+/).some(w => LOCATION_KW.has(w));
}

function hasStopWord(words: string[]): boolean {
  return words.some(w => NAME_STOP_WORDS.has(w.toLowerCase()));
}

/**
 * Score how likely a cleaned line is to be a person's name.
 * Returns:
 *   ≥ 3  → strong name candidate
 *   1-2  → weak candidate (use only if nothing better)
 *   ≤ 0  → not a name
 */
function nameScore(line: string, isFirstDataLine: boolean): number {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return -99;

  // Digit → never a name (standalone numbers handled separately)
  if (/\d/.test(trimmed)) return -10;

  // URLs → not a name
  if (URL_RE.test(trimmed)) return -10;

  // Punctuation typical of addresses (comma after digits)
  if (/[.,@#$%^&*()\[\]{};'"<>?/\\|]/.test(trimmed)) return -5;

  const words = trimmed.split(/\s+/).filter(Boolean);

  // All words must be purely alphabetic
  if (!words.every(w => /^[a-zA-Z]+$/.test(w))) return -5;

  // Location keyword → definitely address territory
  if (hasLocationKw(trimmed)) return -8;

  let score = 0;

  // Ideal name: 2-3 words
  if (words.length === 2 || words.length === 3) score += 4;
  else if (words.length === 1 && trimmed.length >= 3) score += 1;
  else if (words.length === 4) score += 1;
  else if (words.length >= 5) return -3;   // likely a sentence/address

  // Stop words present → penalise
  if (hasStopWord(words)) score -= 2;

  // Title-case proper noun pattern → boost
  if (words.every(w => /^[A-Z][a-z]+$/.test(w))) score += 2;

  // All-lowercase casual typing → small boost if 2+ words
  if (words.length >= 2 && words.every(w => w === w.toLowerCase())) score += 1;

  // Reasonable word lengths (2–15)
  if (words.every(w => w.length >= 2 && w.length <= 15)) score += 1;

  // First real data line is more likely to be the name
  if (isFirstDataLine) score += 1;

  return score;
}

// ── Main export ────────────────────────────────────────────────────────────

export function parseBookingRawText(raw: string): ParsedBookingFields {
  const text = raw.replace(/\r/g, "");

  // ── 1. Phone ─────────────────────────────────────────────────────────────
  const user_phone = phoneFromText(text);

  // ── 2. URL ───────────────────────────────────────────────────────────────
  let live_location_url = (text.match(URL_RE) ?? [""])[0];

  // ── 3. Labeled extraction (highest confidence) ────────────────────────────
  let user_name  = extractLabeled(text, "name");
  const pgName   = extractLabeled(text, "pgName");
  const roomLbl  = extractLabeled(text, "room");
  const contactL = extractLabeled(text, "contact");
  const locLbl   = extractLabeled(text, "liveLocation");

  if (!live_location_url && locLbl?.startsWith("http")) live_location_url = locLbl;

  let resolvedPhone = user_phone;
  if (!resolvedPhone && contactL) {
    const m = contactL.match(/([6-9]\d{9})/);
    if (m) resolvedPhone = "+91" + m[1];
  }

  let address = pgName;
  if (address && roomLbl) address = `${address}, Room ${roomLbl}`;

  // ── 4. Sentence patterns (medium confidence) ──────────────────────────────
  if (!user_name) {
    for (const re of SENTENCE_NAME_RE) {
      const m = text.match(re);
      if (m?.[1]) { user_name = m[1].trim(); break; }
    }
  }

  // ── 5. Line-by-line scoring (fallback for unstructured messages) ──────────
  if (!user_name || !address) {
    // Build clean line list — filter phone, URL, standalone room numbers, noise
    const cleanLines = text
      .split("\n")
      .map(l => strip(l).trim())
      .filter(l => {
        if (!l) return false;
        const bare      = l.replace(/\s/g, "");
        const digitsOnly = bare.replace(/[+\-()]/g, "");
        if (/^\d{10,13}$/.test(digitsOnly)) return false;  // phone-like line
        if (URL_RE.test(l)) return false;               // URL line
        if (ROOM_ONLY_RE.test(bare)) return false;      // room-number-only line
        // Noise: only filter if line has NO location keyword and NO digits
        const isNoise = NOISE_PATTERNS.some(re => re.test(l));
        if (isNoise && !hasLocationKw(l) && !/\d/.test(l)) return false;
        return true;
      });

    // Score each line
    const scored = cleanLines.map((line, idx) => ({
      line,
      score: nameScore(line, idx === 0),
    }));

    // Best name candidate: score ≥ 3
    const best = scored
      .filter(s => s.score >= 3)
      .sort((a, b) => b.score - a.score)[0];

    if (!user_name && best) user_name = best.line;

    // Address: everything that isn't the chosen name
    if (!address) {
      const nameUsed  = best?.line ?? null;
      const addrLines = cleanLines.filter(l => l !== nameUsed);

      // Prefer lines that have location keywords first
      const withKw    = addrLines.filter(l => hasLocationKw(l) || /\d/.test(l));
      const withoutKw = addrLines.filter(l => !hasLocationKw(l) && !/\d/.test(l));
      const ordered   = [...withKw, ...withoutKw];

      // Standalone room number on its own line
      const roomLine  = text.split("\n").find(l => ROOM_ONLY_RE.test(l.trim()));
      const roomNum   = roomLine?.trim() ?? "";

      if (ordered.length > 0) {
        // Join with ", " for readability; deduplicate room if already present
        address = ordered.join(", ");
        if (roomNum && !address.includes(roomNum)) address += `, Room ${roomNum}`;
      } else if (roomNum) {
        address = `Room ${roomNum}`;
      }
    }
  }

  return {
    user_name:                     user_name.trim(),
    user_phone:                    resolvedPhone,
    address:                       address.trim(),
    live_location_url,
    branch:                        "",
    booking_via:                   "whatsapp_to_crm",
    booking_created_date_and_time: localNow(),
  };
}
