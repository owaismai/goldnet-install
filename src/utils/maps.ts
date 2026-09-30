// Address lookup.
//  1. Google Places (New) autocomplete while typing, when VITE_GOOGLE_MAPS_API_KEY is set.
//  2. "Use my current location": phone GPS + OpenStreetMap (Nominatim) reverse geocoding. No key needed.
import { GOOGLE_MAPS_API_KEY } from '../config.ts';
import type { GeoPoint } from '../types.ts';
import { formatNominatim, stripCountry } from './address.ts';

export const googleEnabled = GOOGLE_MAPS_API_KEY !== '';

interface PlaceLike {
  formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  fetchFields(o: { fields: string[] }): Promise<unknown>;
}
interface Prediction {
  text: { text: string };
  toPlace(): PlaceLike;
}
interface PlacesLib {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(o: Record<string, unknown>): Promise<{ suggestions: { placePrediction: Prediction | null }[] }>;
  };
}
type GoogleWindow = Window & {
  google?: { maps?: { importLibrary?: (n: string) => Promise<unknown> } };
  gm_authFailure?: () => void;
};

export interface Suggestion {
  label: string;
  prediction: Prediction;
}

export interface Places {
  lib: PlacesLib;
  newToken(): object;
}

let loader: Promise<Places | null> | null = null;

/** Load the Google Maps script on first use (not at app start). Resolves null if unavailable/offline/bad key. */
export function loadPlaces(): Promise<Places | null> {
  if (!googleEnabled) return Promise.resolve(null);
  loader ??= new Promise<Places | null>((resolve) => {
    const w = window as GoogleWindow;
    const finish = async () => {
      try {
        const lib = (await w.google!.maps!.importLibrary!('places')) as PlacesLib;
        resolve({ lib, newToken: () => new lib.AutocompleteSessionToken() });
      } catch {
        resolve(null);
      }
    };
    if (w.google?.maps?.importLibrary) return void finish();
    w.gm_authFailure = () => resolve(null); // key rejected / API not enabled
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async&v=weekly&language=en&region=ZA`;
    s.async = true;
    s.onload = () => void finish();
    s.onerror = () => {
      loader = null; // offline now: allow a retry later
      resolve(null);
    };
    document.head.appendChild(s);
    window.setTimeout(() => resolve(null), 12000);
  });
  return loader;
}

export async function suggest(p: Places, input: string, token: object): Promise<Suggestion[]> {
  const { suggestions } = await p.lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: token,
    includedRegionCodes: ['za'],
  });
  return suggestions
    .filter((s) => s.placePrediction)
    .slice(0, 5)
    .map((s) => ({ label: stripCountry(s.placePrediction!.text.text), prediction: s.placePrediction! }));
}

export async function resolveSuggestion(s: Suggestion): Promise<{ address: string; location: GeoPoint | null }> {
  const place = s.prediction.toPlace();
  try {
    await place.fetchFields({ fields: ['formattedAddress', 'location'] });
  } catch {
    /* fall back to the prediction text */
  }
  return {
    address: stripCountry(place.formattedAddress || s.label),
    location: place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null,
  };
}

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error('unsupported'), { code: 0 }));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
  return formatNominatim(await res.json());
}
