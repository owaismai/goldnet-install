// Pure address helpers (no DOM/network), shared by the form and the WhatsApp message.
import type { GeoPoint } from '../types.ts';

export const stripCountry = (a: string): string => a.replace(/,?\s*South Africa\s*$/i, '').trim();

interface NominatimResult {
  address?: Record<string, string>;
  display_name?: string;
}

/** South-African style one-line address from an OpenStreetMap (Nominatim) reverse-geocode result. */
export function formatNominatim(r: NominatimResult): string {
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const area = a.suburb || a.neighbourhood || a.village || a.hamlet || a.city_district;
  const town = a.city || a.town || a.municipality;
  const line = [street, area, town, a.postcode].filter(Boolean).join(', ');
  return line || stripCountry(r.display_name ?? '');
}

/** Google Maps link for the message: exact pin when we have coordinates, otherwise a search for the address text. */
export function mapsLink(address: string, loc: GeoPoint | null): string {
  if (loc) return `https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
