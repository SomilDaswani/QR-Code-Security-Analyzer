import {
  parseWifi, parseEmail, parseSms,
  parseGeo, parseVcard, parsePhone,
} from "../utils/qrParsers";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  );
}

function WifiCard({ raw }) {
  const d = parseWifi(raw);
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Wi-Fi Network</p>
      <Row label="Network (SSID)" value={d.ssid} />
      <Row label="Security" value={d.security} />
      <Row label="Password" value={d.password} />
      {d.hidden && <Row label="Hidden" value="Yes" />}
    </>
  );
}

function PhoneCard({ raw }) {
  const d = parsePhone(raw);
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Phone Number</p>
      <Row label="Number" value={d.number} />
    </>
  );
}

function EmailCard({ raw }) {
  const d = parseEmail(raw);
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</p>
      <Row label="To" value={d.address} />
      <Row label="Subject" value={d.subject} />
      <Row label="Body" value={d.body} />
    </>
  );
}

function SmsCard({ raw }) {
  const d = parseSms(raw);
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SMS</p>
      <Row label="To" value={d.number} />
      <Row label="Message" value={d.message} />
    </>
  );
}

function VcardCard({ raw }) {
  const d = parseVcard(raw);
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact (vCard)</p>
      <Row label="Name" value={d.name} />
      <Row label="Phone" value={d.phone} />
      <Row label="Email" value={d.email} />
      <Row label="Organisation" value={d.org} />
      <Row label="Website" value={d.url} />
      <Row label="Address" value={d.address} />
    </>
  );
}

function GeoCard({ raw }) {
  const d = parseGeo(raw);
  const mapsUrl = `https://www.google.com/maps?q=${d.lat},${d.lng}`;
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Location</p>
      <Row label="Latitude" value={d.lat} />
      <Row label="Longitude" value={d.lng} />
      {d.label && <Row label="Label" value={d.label} />}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-blue-500 underline mt-1 inline-block"
      >
        Open in Google Maps
      </a>
    </>
  );
}

function TextCard({ raw }) {
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Plain Text</p>
      <p className="text-sm text-gray-800 break-all whitespace-pre-wrap">{raw}</p>
    </>
  );
}

const CARDS = {
  WIFI:  WifiCard,
  PHONE: PhoneCard,
  EMAIL: EmailCard,
  SMS:   SmsCard,
  VCARD: VcardCard,
  GEO:   GeoCard,
  TEXT:  TextCard,
};

export default function ContentCard({ type, data }) {
  const Card = CARDS[type] ?? TextCard;
  return (
    <div className="max-w-md mx-auto mt-4 rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-600">{type}</span>
      </div>
      <div className="p-4 space-y-2">
        <Card raw={data} />
      </div>
    </div>
  );
}
