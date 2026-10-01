import { useEffect, useId, useRef, useState } from 'react';
import { Field } from './Fields.tsx';
import type { GeoPoint } from '../types.ts';
import { getBestPosition, googleEnabled, loadPlaces, locationPermission, resolveSuggestion, reverseGeocode, suggest } from '../utils/maps.ts';
import type { Places, Suggestion } from '../utils/maps.ts';
import { autoLocationTried, markAutoLocationTried } from '../utils/storage.ts';

interface Props {
  value: string;
  location: GeoPoint | null;
  error?: string;
  onChange: (address: string, location: GeoPoint | null) => void;
}

const inputCls =
  'block w-full min-h-12 rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-500 focus:border-brand';

const UNAVAILABLE = 'Google address search is not available right now. Type the address or use your current location.';

/**
 * Street address. FIRST option: "Use my current location" (phone GPS fills the address, and runs by itself
 * when a new installation starts with an empty address). Then typing with Google Maps suggestions (needs the
 * Google key). Typing the address by hand always works.
 */
export default function AddressField({ value, location, error, onChange }: Props) {
  const id = useId();
  const listId = useId();
  const [places, setPlaces] = useState<Places | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const token = useRef<object | null>(null);
  const skipValue = useRef<string | null>(null); // a value we set ourselves (pick / GPS): do not search for it
  const seq = useRef(0);
  const latest = useRef({ value, location, onChange });
  latest.current = { value, location, onChange };

  // Load Google only when the field is first used.
  const warm = () => {
    if (googleEnabled && !places) loadPlaces().then((p) => {
        if (p) {
          setPlaces(p);
          setNote((n) => (n?.text === UNAVAILABLE ? null : n)); // it works now: drop the earlier warning
        } else setNote({ text: UNAVAILABLE, bad: true });
      });
  };

  useEffect(() => {
    if (skipValue.current !== null && value === skipValue.current) return;
    const q = value.trim();
    if (!places || q.length < 3) {
      setItems([]);
      return;
    }
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        token.current ??= places.newToken();
        const res = await suggest(places, q, token.current);
        if (mine === seq.current) {
          setItems(res);
          setOpen(res.length > 0);
        }
      } catch {
        if (mine === seq.current) {
          setItems([]);
          setNote({ text: UNAVAILABLE, bad: true }); // e.g. the Places API is not enabled for the key, or no internet
        }
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [value, places]);

  async function pick(s: Suggestion) {
    setOpen(false);
    setItems([]);
    const r = await resolveSuggestion(s);
    token.current = null; // a new search session starts after each pick
    skipValue.current = r.address;
    latest.current.onChange(r.address, r.location);
  }

  async function useMyLocation(auto = false) {
    setNote(null);
    setGpsBusy(true);
    setProgress('Finding your location…');
    try {
      const pos = await getBestPosition(15000, 40, (m) => setProgress(`Finding your location… (accurate to about ${m} m)`));
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const acc = Math.round(pos.coords.accuracy);
      setProgress('Looking up the street address…');
      let addr = '';
      let lookupFailed = false;
      try {
        addr = await reverseGeocode(loc.lat, loc.lng);
      } catch {
        lookupFailed = true;
      }
      // never overwrite something the technician typed while we were searching
      if (auto && latest.current.value.trim()) return;
      const text = addr || latest.current.value;
      skipValue.current = text;
      setOpen(false);
      latest.current.onChange(text, loc);
      setNote(
        addr
          ? { text: `Address filled from your location (accurate to about ${acc} m). Check it and correct it if needed.`, bad: false }
          : {
              text: lookupFailed
                ? 'Got your location, but the street address lookup failed (check your internet). A map pin was saved. Please type the address.'
                : 'Got your location and saved a map pin, but no street address exists for this spot. Please type the address.',
              bad: true,
            },
      );
    } catch (e) {
      if (auto && (e as { code?: number }).code === 1) return; // auto-run declined: stay quiet, the button is right there
      const code = (e as { code?: number }).code;
      setNote({
        text:
          code === 1
            ? 'Location permission was denied. Allow Location for this site (tap the lock icon in the address bar > Permissions > Location), then press the button again. Or type the address.'
            : code === 3
              ? 'Could not get a GPS fix in time. Go outside or near a window and press the button again, or type the address.'
              : 'Your location is not available on this device. Type the address instead.',
        bad: true,
      });
    } finally {
      setGpsBusy(false);
      setProgress('');
    }
  }

  // New installation with an empty address: fill it from the phone's location automatically (once).
  useEffect(() => {
    if (autoLocationTried() || latest.current.value.trim() || latest.current.location) return;
    let alive = true;
    locationPermission().then((perm) => {
      if (!alive || perm === 'denied' || autoLocationTried()) return;
      markAutoLocationTried();
      void useMyLocation(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field label="Street Address" required error={error} htmlFor={id}>
      <div className="relative space-y-3">
        <button type="button" onClick={() => void useMyLocation()} disabled={gpsBusy} className="min-h-14 w-full rounded-xl bg-brand text-lg font-bold text-white shadow disabled:opacity-60">
          {gpsBusy ? 'Finding your location…' : '📍 USE MY CURRENT LOCATION'}
        </button>
        {progress && <p role="status" className="text-sm text-gray-700">{progress}</p>}
        <p className="text-center text-sm text-gray-600">{googleEnabled ? 'or start typing and pick the address from Google Maps' : 'or type the address'}</p>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          autoComplete="off"
          value={value}
          onFocus={warm}
          onChange={(e) => onChange(e.target.value, null)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className={inputCls}
        />
        {open && items.length > 0 && (
          <ul id={listId} role="listbox" aria-label="Address suggestions" className="absolute inset-x-0 z-10 max-h-72 overflow-auto rounded-xl border border-gray-300 bg-white shadow-lg">
            {items.map((s, i) => (
              <li key={i} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(s)} className="flex min-h-12 w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-base last:border-b-0 active:bg-teal-50">
                  <span aria-hidden="true">📍</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {location && !note && <p className="text-sm text-green-800">✓ Map pin saved for this address.</p>}
        {note && <p role={note.bad ? 'alert' : 'status'} className={`text-sm ${note.bad ? 'font-medium text-red-700' : 'text-gray-700'}`}>{note.text}</p>}
      </div>
    </Field>
  );
}
