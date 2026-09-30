import { lazy, Suspense, useState } from 'react';
import { normaliseSerial } from '../utils/serial.ts';
import type { SerialSource } from '../types.ts';

// zxing is large: load it only when the technician first opens the scanner (it is still precached for offline use).
const BarcodeScanner = lazy(() => import('./BarcodeScanner.tsx'));

interface Props {
  label: string; // "CPE" | "Router"
  serial: string;
  source: SerialSource;
  onChange: (serial: string, source: SerialSource) => void;
  error?: string;
}

/** Barcode-first serial number: SCAN -> auto-filled -> (SCAN AGAIN | Enter Manually). */
export default function SerialNumberField({ label, serial, source, onChange, error }: Props) {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState('');
  const upper = label.toUpperCase();

  const startManual = () => {
    setScanning(false);
    setDraft(serial);
    setManual(true);
  };

  const saveManual = () => {
    const v = normaliseSerial(draft);
    if (!v) return;
    onChange(v, 'manual');
    setManual(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold tracking-wide text-gray-900">{label} SERIAL NUMBER</h3>

      {manual ? (
        <div className="space-y-3">
          <label htmlFor={`${label}-manual`} className="block text-sm text-gray-700">
            Type the {label} serial number exactly as printed on the label
          </label>
          <input
            id={`${label}-manual`}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="block min-h-14 w-full rounded-xl border border-gray-400 px-3 font-mono text-lg"
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => setManual(false)} className="min-h-14 flex-1 rounded-xl border-2 border-gray-400 bg-white text-lg font-semibold">
              Cancel
            </button>
            <button type="button" onClick={saveManual} disabled={!normaliseSerial(draft)} className="min-h-14 flex-1 rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-40">
              Save serial
            </button>
          </div>
        </div>
      ) : serial ? (
        <div className="space-y-3">
          <p role="status" className={`text-lg font-bold ${source === 'barcode' ? 'text-green-800' : 'text-amber-800'}`}>
            {source === 'barcode' ? '✓ BARCODE SCANNED' : '✎ ENTERED MANUALLY'}
          </p>
          <div>
            <p className="text-sm text-gray-700">{label} Serial Number</p>
            <p data-testid={`${label.toLowerCase()}-serial`} className="mt-1 break-all rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 font-mono text-xl font-semibold">
              {serial}
            </p>
          </div>
          <button type="button" onClick={() => setScanning(true)} className="min-h-14 w-full rounded-xl border-2 border-brand bg-white text-lg font-bold text-brand-dark">
            📷 SCAN AGAIN
          </button>
          <button type="button" onClick={startManual} className="min-h-11 text-base text-gray-700 underline">
            Enter Manually
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={() => setScanning(true)} className="min-h-16 w-full rounded-xl bg-brand text-lg font-bold text-white shadow active:bg-brand-dark">
            📷 SCAN {upper} BARCODE
          </button>
          <button type="button" onClick={startManual} className="min-h-11 text-base text-gray-700 underline">
            Enter Manually
          </button>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        </div>
      )}

      {scanning && (
        <Suspense fallback={<div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">Loading scanner…</div>}>
        <BarcodeScanner
          title={`SCAN ${upper} BARCODE`}
          onResult={(value) => {
            onChange(value, 'barcode');
            setScanning(false);
          }}
          onCancel={() => setScanning(false)}
          onManual={startManual}
        />
        </Suspense>
      )}
    </div>
  );
}
