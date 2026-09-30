import { useEffect, useId, useRef, useState } from 'react';
import { Field } from './Fields.tsx';
import type { GeoPoint } from '../types.ts';
import { getPosition, googleEnabled, loadPlaces, resolveSuggestion, reverseGeocode, suggest } from '../utils/maps.ts';
import type { Places, Suggestion } from '../utils/maps.ts';

interface Props {
  value: string;
  error?: string;
  onChange: (address: string, location: GeoPoint | null) => void;
}

const inputCls =
  'block w-full min-h-12 rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-500 focus:border-brand';

const UNAVAILABLE = 'Google address search is not available right now. Type the address or use your current location.';

/**
 * Street address with Google Maps autofill: suggestions while typing (needs the Google key), and a
 * "Use my current location" button (phone GPS, no key). Typing the address by hand always works.
 */
export default function AddressField({ value, error, onChange }: Props) {
  const id = useId();
  const listId = useId();
  const [places, setPlaces] = useState<Places | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [note, setNote] = useState('');
  const token = useRef<object | null>(null);
  const skip = useRef(false); // do not search again right after a pick / GPS fill
  const seq = useRef(0);

  // Load Google only when the field is first used.
  const warm = () => {
    if (googleEnabled && !places)
      loadPlaces().then((p) => (p ? setPlaces(p) : setNote(UNAVAILABLE)));
  };

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
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
          setNote(UNAVAILABLE); // e.g. the Places API is not enabled for the key, or no internet
        }
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [value, places]);

  async function pick(s: Suggestion) {
    skip.current = true;
    setOpen(false);
    setItems([]);
    const r = await resolveSuggestion(s);
    token.current = null; // a new search session starts after each pick
    skip.current = true;
    onChange(r.address, r.location);
  }

  async function useMyLocation() {
    setNote('');
    setGpsBusy(true);
    try {
      const pos = await getPosition();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const addr = await reverseGeocode(loc.lat, loc.lng).catch(() => '');
      skip.current = true;
      setOpen(false);
      onChange(addr || value, loc);
      setNote(
        addr
          ? 'Address filled from your location. Check it and correct it if needed.'
          : 'Location saved (map pin added) but no street address was found. Type the address.',
      );
    } catch (e) {
      const code = (e as { code?: number }).code;
      setNote(
        code === 1
          ? 'Location permission was denied. Allow location for this site in the browser settings, or type the address.'
          : code === 3
            ? 'Finding your location took too long. Move outside or try again, or type the address.'
            : 'Your location is not available here. Type the address instead.',
      );
    } finally {
      setGpsBusy(false);
    }
  }

  return (
    <Field label="Street Address" required error={error} htmlFor={id} hint={googleEnabled ? 'Start typing and pick your address from Google Maps' : undefined}>
      <div className="relative space-y-2">
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
        <button type="button" onClick={useMyLocation} disabled={gpsBusy} className="min-h-12 w-full rounded-xl border-2 border-brand bg-white text-base font-semibold text-brand-dark disabled:opacity-50">
          {gpsBusy ? 'Finding your location…' : '📍 Use my current location'}
        </button>
        {note && <p role="status" className="text-sm text-gray-700">{note}</p>}
      </div>
    </Field>
  );
}
