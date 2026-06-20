const RULES = [
  { prefix: "https://",   type: "URL" },
  { prefix: "http://",    type: "URL" },
  { prefix: "WIFI:",      type: "WIFI" },
  { prefix: "tel:",       type: "PHONE" },
  { prefix: "mailto:",    type: "EMAIL" },
  { prefix: "SMSTO:",     type: "SMS" },
  { prefix: "BEGIN:VCARD", type: "VCARD" },
  { prefix: "geo:",       type: "GEO" },
];

/**
 * Classify a raw QR decoded string.
 * Returns { type, data } where data is the raw string.
 */
export function classifyQR(raw) {
  if (!raw || typeof raw !== "string") {
    return { type: "TEXT", data: raw ?? "" };
  }

  for (const { prefix, type } of RULES) {
    if (raw.startsWith(prefix)) {
      console.log(`[qrContent] Classified as ${type}: ${raw}`);
      return { type, data: raw };
    }
  }

  console.log(`[qrContent] Classified as TEXT: ${raw}`);
  return { type: "TEXT", data: raw };
}
