// Pre-fill from the GOLDNET Radio installer app (radio-app/ in owaismai/claude1, 7 Nov 2026). After aligning the client
// radio, the app opens this form with query parameters:
//   cpe        the radio's serial (or MAC)            -> CPE serial (source "manual"; the barcode photo is still asked for)
//   cpe_model  e.g. "Reyee AIRMETRO460F", "Cambium Force 4525L" -> the matching CPE choice, else "Other" with that text
//   signal     e.g. "-58 dBm (expected -56)"           -> Signal
//   speedtest  e.g. "312.4 / 118.9 Mbps (link test)"   -> Speed test (only when the form's is empty)
//   lat, lon   phone GPS where the radio was aligned   -> location (map pin), when the form has none yet
//   notes      radio, sector, signal vs expected       -> added once to the installer comments
// The form keeps working without them; nothing is sent anywhere by this. The query is removed after it is read, so a
// reload doesn't apply it twice.
import { OTHER } from '../types.ts';
import type { Choice, FormState } from '../types.ts';

const MODEL_MATCH: [RegExp, string][] = [[/460\s*G/i, 'Reyee 460G'], [/460\s*F/i, 'Reyee 460F'], [/4525\s*L/i, 'Cambium 4525L']];

function modelChoice(text: string, current: Choice): Choice {
  const hit = MODEL_MATCH.find(([re]) => re.test(text));
  if (hit) return current.selected.includes(hit[1]) ? current : { selected: [...current.selected.filter((s) => s !== OTHER), hit[1]], other: current.other };
  return { selected: [...current.selected.filter((s) => s !== OTHER), OTHER], other: text.slice(0, 80) };
}

export function hasPrefill(search: string): boolean {
  const q = new URLSearchParams(search);
  return ['cpe', 'cpe_model', 'signal', 'speedtest', 'lat', 'notes'].some((k) => q.has(k));
}

export function applyPrefill(form: FormState, search: string): FormState {
  const q = new URLSearchParams(search);
  const out: FormState = { ...form };
  const cpe = (q.get('cpe') || '').trim();
  if (cpe) { out.cpeSerial = cpe.slice(0, 40); out.cpeSerialSource = 'manual'; }
  const model = (q.get('cpe_model') || '').trim();
  if (model) out.cpeModel = modelChoice(model, form.cpeModel);
  const signal = (q.get('signal') || '').trim();
  if (signal) out.signal = signal.slice(0, 60);
  const speed = (q.get('speedtest') || '').trim();
  if (speed && !form.speedtest) out.speedtest = speed.slice(0, 60);
  const lat = parseFloat(q.get('lat') || ''), lng = parseFloat(q.get('lon') || '');
  if (!form.location && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) out.location = { lat, lng };
  const notes = (q.get('notes') || '').trim().slice(0, 600);
  if (notes && !form.comments.includes(notes)) out.comments = form.comments ? form.comments + '\n' + notes : notes;
  return out;
}
