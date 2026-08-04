/**
 * Address geocoding (forward + reverse) via OpenStreetMap Nominatim.
 * Optional: set GEOCODE_PROVIDER=google and GOOGLE_MAPS_API_KEY for Google.
 *
 * Nominatim usage policy: max ~1 req/sec, identify app via User-Agent.
 */
const axios = require('axios');

const USER_AGENT = process.env.GEOCODE_USER_AGENT || 'CasinoPlatformKYC/1.0 (admin@casino.local)';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Simple in-process rate limit for Nominatim
let lastNominatimCall = 0;
async function throttleNominatim() {
  const wait = 1100 - (Date.now() - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

/**
 * Forward geocode: address text → { lat, lng, displayName, raw }
 */
async function geocodeAddress(address, opts = {}) {
  const q = String(address || '').trim();
  if (!q) return null;

  const provider = (process.env.GEOCODE_PROVIDER || 'nominatim').toLowerCase();

  try {
    if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
      return await geocodeGoogle(q, opts);
    }
    return await geocodeNominatim(q, opts);
  } catch (err) {
    console.warn('Geocode failed:', err.message);
    return null;
  }
}

/**
 * Reverse geocode: lat,lng → display address
 */
async function reverseGeocode(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const provider = (process.env.GEOCODE_PROVIDER || 'nominatim').toLowerCase();
  try {
    if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
      const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { latlng: `${latitude},${longitude}`, key: process.env.GOOGLE_MAPS_API_KEY },
        timeout: 8000,
      });
      const hit = data.results?.[0];
      if (!hit) return null;
      return {
        lat: latitude,
        lng: longitude,
        displayName: hit.formatted_address,
        raw: hit,
      };
    }

    await throttleNominatim();
    const { data } = await axios.get(`${NOMINATIM}/reverse`, {
      params: { lat: latitude, lon: longitude, format: 'json', addressdetails: 1 },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    if (!data || data.error) return null;
    return {
      lat: latitude,
      lng: longitude,
      displayName: data.display_name,
      raw: data,
    };
  } catch (err) {
    console.warn('Reverse geocode failed:', err.message);
    return null;
  }
}

async function geocodeNominatim(q, opts = {}) {
  await throttleNominatim();
  const { data } = await axios.get(`${NOMINATIM}/search`, {
    params: {
      q,
      format: 'json',
      limit: 1,
      addressdetails: 1,
      countrycodes: opts.countrycodes || process.env.GEOCODE_COUNTRY || 'ph',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 8000,
  });
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
    raw: hit,
  };
}

async function geocodeGoogle(q, opts = {}) {
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: {
      address: q,
      key: process.env.GOOGLE_MAPS_API_KEY,
      region: opts.region || process.env.GEOCODE_REGION || 'ph',
    },
    timeout: 8000,
  });
  const hit = data.results?.[0];
  if (!hit) return null;
  return {
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
    displayName: hit.formatted_address,
    raw: hit,
  };
}

/** Parse "lat,lng" or "lat, lng" string */
function parseCoords(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function mapsLink(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  parseCoords,
  mapsLink,
};
