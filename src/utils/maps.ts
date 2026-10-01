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
    // With loading=async the script's onload fires BEFORE google.maps.importLibrary exists. Google calls the
    // `callback` function once the API is really ready, so wait for that instead.
    (window as unknown as Record<string, () => void>).__goldnetMapsReady = () => void finish();
    // Mobile networks drop requests: retry the script up to 3 times before giving up.
    const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async&callback=__goldnetMapsReady&v=weekly&language=en&region=ZA`;
    const load = (attempt: number) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onerror = () => {
        s.remove();
        if (attempt < 3) window.setTimeout(() => load(attempt + 1), 1200 * attempt);
        else {
          loader = null; // allow another try later (e.g. when back online)
          resolve(null);
        }
      };
      document.head.appendChild(s);
    };
    load(1);
    window.setTimeout(() => {
      loader = null;
      resolve(null);
    }, 25000);
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

export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unknown';

export async function locationPermission(): Promise<LocationPermission> {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    return (await navigator.permissions.query({ name: 'geolocation' as PermissionName })).state as LocationPermission;
  } catch {
    return 'unknown';
  }
}

/**
 * Best GPS fix within `maxMs`: watches the position and stops early once it is accurate to `goodMetres`.
 * If there is no fix after a few seconds (indoors), also asks for a quick network/Wi-Fi location so the
 * technician still gets something. Rejects immediately when permission is denied.
 */
export function getBestPosition(maxMs = 15000, goodMetres = 40, onUpdate?: (accuracyM: number) => void): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;
    if (!geo) return reject(Object.assign(new Error('unsupported'), { code: 0 }));
    let best: GeolocationPosition | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      geo.clearWatch(watch);
      window.clearTimeout(coarse);
      window.clearTimeout(limit);
      fn();
    };
    const consider = (pos: GeolocationPosition) => {
      if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
      onUpdate?.(Math.round(best.coords.accuracy));
      if (pos.coords.accuracy <= goodMetres) finish(() => resolve(pos));
    };
    const fail = (err: GeolocationPositionError) => {
      if (err.code === 1) finish(() => reject(err)); // permission denied: no point waiting
    };
    const watch = geo.watchPosition(consider, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs });
    const coarse = window.setTimeout(() => {
      if (!best) geo.getCurrentPosition(consider, fail, { enableHighAccuracy: false, maximumAge: 60000, timeout: 6000 });
    }, 5000);
    const limit = window.setTimeout(() => {
      if (best) finish(() => resolve(best!));
      else finish(() => reject(Object.assign(new Error('timeout'), { code: 3 })));
    }, maxMs);
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`;
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return formatNominatim(await res.json());
      last = new Error(`address lookup ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => window.setTimeout(r, 800));
  }
  throw last;
}
