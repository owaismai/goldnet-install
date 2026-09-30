import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../utils/camera.ts';
import { deletePhoto, loadPhoto, savePhoto } from '../utils/photoStore.ts';
import type { PhotoKey } from '../utils/photoStore.ts';

interface Props {
  photoKey: PhotoKey;
  label: string; // "CPE" | "Router"
  onChange: (hasPhoto: boolean) => void;
  error?: string;
}

// An <input type="file" capture="environment"> opens the phone's native camera
// app on Android and iOS; it is the most reliable photo path across browsers
// and gives full-resolution, autofocused pictures. The camera only opens when
// the technician presses the button.
//
// Flow: TAKE PHOTO -> preview -> Retake / Confirm -> captured (Retake / Remove).
export default function PhotoCapture({ photoKey, label, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  const [confirmed, setConfirmed] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Restore a confirmed photo after an accidental refresh.
  useEffect(() => {
    let alive = true;
    loadPhoto(photoKey).then((blob) => {
      if (!alive) return;
      if (blob) setConfirmed({ blob, url: URL.createObjectURL(blob) });
      onChangeRef.current(!!blob);
    });
    return () => {
      alive = false;
    };
  }, [photoKey]);

  // Free object URLs we no longer show.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);
  useEffect(() => () => { if (confirmed) URL.revokeObjectURL(confirmed.url); }, [confirmed]);

  const open = () => inputRef.current?.click();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow taking the same photo again
    if (!file) return; // cancelled in the camera app
    setBusy(true);
    setProblem('');
    try {
      const blob = await compressImage(file);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setProblem('That photo could not be processed. Please take it again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await savePhoto(photoKey, pending.blob);
    } catch {
      // Storage full/blocked: keep the photo in memory for this session anyway.
    }
    setConfirmed(pending);
    setPending(null);
    setBusy(false);
    onChange(true);
  }

  async function remove() {
    await deletePhoto(photoKey);
    setConfirmed(null);
    setPending(null);
    onChange(false);
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
  );

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold tracking-wide text-gray-900">{label.toUpperCase()} PHOTO</h3>
      {fileInput}

      {busy && <p role="status" className="text-gray-700">Processing photo…</p>}
      {problem && <p role="alert" className="text-sm font-medium text-red-700">{problem}</p>}

      {pending ? (
        <div className="space-y-3">
          <img src={pending.url} alt={`${label} photo preview`} className="max-h-80 w-full rounded-xl border border-gray-300 bg-gray-100 object-contain" />
          <p className="text-sm text-gray-700">Check the label is sharp and readable, then confirm.</p>
          <div className="flex gap-3">
            <button type="button" onClick={open} className="min-h-14 flex-1 rounded-xl border-2 border-gray-400 bg-white text-lg font-semibold">
              Retake
            </button>
            <button type="button" onClick={confirm} disabled={busy} className="min-h-14 flex-1 rounded-xl bg-brand text-lg font-bold text-white">
              Confirm
            </button>
          </div>
        </div>
      ) : confirmed ? (
        <div className="space-y-3">
          <p role="status" className="text-lg font-bold text-green-800">✓ {label.toUpperCase()} PHOTO CAPTURED</p>
          <img src={confirmed.url} alt={`Confirmed ${label} photo`} className="max-h-48 rounded-xl border border-gray-300 object-contain" />
          <div className="flex gap-3">
            <button type="button" onClick={open} className="min-h-12 flex-1 rounded-xl border-2 border-gray-400 bg-white text-base font-semibold">
              Retake
            </button>
            <button type="button" onClick={remove} className="min-h-12 flex-1 rounded-xl border-2 border-red-300 bg-white text-base font-semibold text-red-700">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={open} disabled={busy} className="min-h-16 w-full rounded-xl bg-brand text-lg font-bold text-white shadow active:bg-brand-dark">
          📷 TAKE {label.toUpperCase()} PHOTO
        </button>
      )}
      {error && !pending && !confirmed && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
