const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const randomPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

// Distancia en km entre dos puntos (fórmula del haversine)
function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isNightHour(hour, start, end) {
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

function estimateFare(km, fares, date = new Date()) {
  let fare = fares.base + km * fares.perKm;
  if (isNightHour(date.getHours(), fares.nightStartHour, fares.nightEndHour)) {
    fare *= 1 + fares.nightSurchargePct / 100;
  }
  fare = Math.max(fare, fares.minimum);
  return Math.round(fare * 2) / 2; // redondeo a 0,50
}

const normalizePhone = (phone) => String(phone || '').replace(/[\s\-().]/g, '');

const isLatLng = (p) =>
  p != null &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

const cleanText = (value, max = 200) => (value == null ? '' : String(value).trim().slice(0, max));

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  randomPin,
  distanceKm,
  estimateFare,
  normalizePhone,
  isLatLng,
  cleanText,
};
