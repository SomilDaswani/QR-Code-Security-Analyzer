export function parseWifi(raw) {
  // Strip "WIFI:" prefix so fields starting immediately after it are matched by ^
  const body = raw.replace(/^WIFI:/i, "");
  const get = (key) => {
    const m = body.match(new RegExp(`(?:^|;)${key}:([^;]*)`));
    return m ? m[1] : "";
  };
  return {
    ssid: get("S"),
    password: get("P"),
    security: get("T") || "None",
    hidden: get("H") === "true",
  };
}

export function parseEmail(raw) {
  const withoutScheme = raw.replace(/^mailto:/i, "");
  const [address, query = ""] = withoutScheme.split("?");
  const params = new URLSearchParams(query);
  return {
    address,
    subject: params.get("subject") || "",
    body: params.get("body") || "",
  };
}

export function parseSms(raw) {
  const withoutScheme = raw.replace(/^SMSTO:/i, "");
  const idx = withoutScheme.indexOf(":");
  return {
    number: idx >= 0 ? withoutScheme.slice(0, idx) : withoutScheme,
    message: idx >= 0 ? withoutScheme.slice(idx + 1) : "",
  };
}

export function parseGeo(raw) {
  const [coords, query = ""] = raw.replace(/^geo:/i, "").split("?");
  const [lat = "", lng = ""] = coords.split(",");
  const params = new URLSearchParams(query);
  return { lat: lat.trim(), lng: lng.trim(), label: params.get("q") || "" };
}

export function parseVcard(raw) {
  const get = (key) => {
    const m = raw.match(new RegExp(`^${key}[^:\n]*:(.+)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  return {
    name: get("FN"),
    phone: get("TEL"),
    email: get("EMAIL"),
    org: get("ORG"),
    url: get("URL"),
    address: get("ADR"),
  };
}

export function parsePhone(raw) {
  return { number: raw.replace(/^tel:/i, "") };
}
