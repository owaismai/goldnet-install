import { useEffect, useRef, useState } from 'react';
import { createDetector, createWasmDetector, decodeImageFile } from '../utils/barcode.ts';
import type { Detector } from '../utils/barcode.ts';
import { normaliseSerial } from '../utils/serial.ts';
import { describeCameraError } from '../utils/camera.ts';
import type { CameraProblem } from '../utils/camera.ts';
import { createStillGrabber, findFocusableCamera, listBackCameras, openStream, setFocus, setTorch, setZoom, stopStream, tapFocus, tuneTrack } from '../utils/scannerCamera.ts';
import type { Cam, TrackInfo } from '../utils/scannerCamera.ts';

interface Props {
  title: string; // e.g. "SCAN CPE BARCODE"
  onResult: (value: string, format: string) => void;
  onCancel: () => void;
  onManual: () => void;
}

// Require the same value on two consecutive decodes: filters one-off misreads.
const CONFIRM_READS = 2;
// If the live picture has not decoded after this long, also read high-resolution stills (ImageCapture).
const ASSIST_AFTER_MS = 2500;

type FocusPreset = 'auto' | 'close' | 'mid';
const FOCUS_METRES: Record<FocusPreset, number | null> = { auto: null, close: 0.12, mid: 0.25 };

/**
 * Full-screen rear-camera scanner. Mounted only after the technician presses a SCAN button, so the
 * permission prompt never appears unprompted. Detects automatically (no capture button), vibrates,
 * then stops the camera and closes. Small barcodes: continuous autofocus, tap-to-focus, zoom,
 * torch, camera switching, and a "scan from photo" fallback that uses the phone's camera app.
 */
export default function BarcodeScanner({ title, onResult, onCancel, onManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const deviceRef = useRef<string | undefined>(undefined);
  const triedAuto = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cb = useRef({ onResult });
  cb.current = { onResult };

  const [mode, setMode] = useState<'live' | 'photo'>('live');
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [starting, setStarting] = useState(true);
  const [found, setFound] = useState<string | null>(null);
  const [info, setInfo] = useState<TrackInfo | null>(null);
  const [cams, setCams] = useState<Cam[]>([]);
  const [zoom, setZoomState] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [engine, setEngine] = useState('');
  const [photoMsg, setPhotoMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [assist, setAssist] = useState(false);
  const [focusPreset, setFocusPreset] = useState<FocusPreset>('auto');

  const finish = (text: string, format: string) => {
    try {
      navigator.vibrate?.(200);
    } catch {
      /* unsupported */
    }
    setFound(text);
    // brief success feedback, then hand the value back
    window.setTimeout(() => cb.current.onResult(text, format), 650);
  };

  // ---- live camera ----
  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    let done = false;
    let timer = 0;
    let assistTimer = 0;
    let last = '';
    let count = 0;
    setProblem(null);
    setStarting(true);
    setTorchOn(false);
    setAssist(false);
    setFocusPreset('auto');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
        // Preview resolution matters for tiny barcodes: ask for 4K where the fast native detector exists
        // (Android Chrome); the browser gives the best it has. WASM engine (iPhone): 1080p keeps it smooth.
        const hasNative = 'BarcodeDetector' in window;
        const stream = await openStream(deviceRef.current, hasNative ? 3840 : 1920, hasNative ? 2160 : 1080);
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const ti = await tuneTrack(track);
        if (cancelled) return;
        setInfo(ti);
        setZoomState(1);
        const list = await listBackCameras().catch(() => []);
        if (cancelled) return;
        setCams(list);

        // Android: this lens has no autofocus (often the ultra-wide). Look for one that does.
        if (ti.focusKnown && !ti.continuousFocus && list.length > 1 && !triedAuto.current) {
          triedAuto.current = true;
          const better = await findFocusableCamera(list, ti.deviceId);
          if (cancelled) return;
          if (better) {
            deviceRef.current = better;
            stopStream(stream);
            setAttempt((n) => n + 1);
            return;
          }
        }
        setStarting(false);

        let det: Detector = await createDetector();
        setEngine(det.kind === 'native' ? 'Android scanner' : 'Scanner');
        const tick = async () => {
          if (cancelled || done) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const res = await det.detect(video);
              const text = res.length ? normaliseSerial(res[0].text) : '';
              if (text) {
                if (text === last) count += 1;
                else {
                  last = text;
                  count = 1;
                }
                if (count >= CONFIRM_READS) {
                  done = true;
                  stopStream(streamRef.current); // close the camera straight away
                  finish(text, res[0].format);
                  return;
                }
              }
            } catch {
              if (det.kind === 'native') det = createWasmDetector(); // native engine failed: switch
            }
          }
          timer = window.setTimeout(tick, det.kind === 'native' ? 50 : 90);
        };
        tick();

        // Still-capture assist: stills run a real autofocus and use the full sensor, so a tiny barcode
        // that is too small/soft in the live preview can still be read (same as "Scan from photo").
        const grab = createStillGrabber(track);
        if (grab) {
          assistTimer = window.setTimeout(async () => {
            if (cancelled || done) return;
            setAssist(true);
            while (!cancelled && !done) {
              try {
                const blob = await grab();
                if (cancelled || done) break;
                const r = await decodeImageFile(blob, { tiles: false });
                const text = r ? normaliseSerial(r.text) : '';
                if (r && text && !done && !cancelled) {
                  done = true;
                  stopStream(streamRef.current);
                  finish(text, r.format);
                  break;
                }
              } catch {
                /* capture failed (busy/unsupported): try again */
              }
              await new Promise((res) => window.setTimeout(res, 600));
            }
            if (!cancelled) setAssist(false);
          }, ASSIST_AFTER_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setProblem(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(assistTimer);
      stopStream(streamRef.current);
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [mode, attempt]);

  function onTapFocus(e: React.MouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track || found) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setRing({ x: e.clientX - r.left, y: e.clientY - r.top });
    window.setTimeout(() => setRing(null), 900);
    tapFocus(track, x, y).catch(() => {});
  }

  async function changeZoom(z: number) {
    if (!trackRef.current) return;
    try {
      await setZoom(trackRef.current, z);
      setZoomState(z);
    } catch {
      /* ignore */
    }
  }

  async function toggleTorch() {
    if (!trackRef.current) return;
    try {
      await setTorch(trackRef.current, !torchOn);
      setTorchOn(!torchOn);
    } catch {
      setInfo((i) => (i ? { ...i, torch: false } : i));
    }
  }

  async function changeFocus(preset: FocusPreset) {
    if (!trackRef.current) return;
    try {
      await setFocus(trackRef.current, FOCUS_METRES[preset]);
      setFocusPreset(preset);
    } catch {
      /* ignore */
    }
  }

  function switchCamera() {
    if (cams.length < 2) return;
    const cur = cams.findIndex((c) => c.id === info?.deviceId);
    deviceRef.current = cams[(cur + 1) % cams.length].id;
    triedAuto.current = true;
    stopStream(streamRef.current);
    setAttempt((n) => n + 1);
  }

  // ---- scan from a close-up photo taken with the phone's own camera app ----
  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setPhotoMsg('Reading barcode…');
    try {
      const res = await decodeImageFile(file);
      if (res) {
        const text = normaliseSerial(res.text);
        if (text) return finish(text, res.format);
      }
      setPhotoMsg('No barcode found in that photo. Get closer, keep the barcode sharp and flat, avoid glare, then try again.');
    } catch {
      setPhotoMsg('That photo could not be read. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const zoomLevels = info?.zoom ? [1, 2, 3, 4, 5].filter((z) => z >= info.zoom!.min && z <= info.zoom!.max) : [];

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <h2 className="px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-center text-xl font-bold tracking-wide">{title}</h2>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhotoPicked} className="sr-only" tabIndex={-1} aria-hidden="true" />

      {mode === 'photo' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl" aria-hidden="true">📷</p>
          <p className="text-xl font-semibold">Scan from a close-up photo</p>
          <p className="max-w-sm text-base text-gray-200">
            Your phone&apos;s camera app focuses much better than the live scanner. Take one sharp, close photo of the barcode
            (fill the picture with it, tap it to focus) and the serial is read from the photo.
          </p>
          {found ? (
            <div role="status" className="rounded-xl bg-green-700 px-4 py-3 text-lg font-bold">✓ BARCODE SCANNED · <span className="break-all font-mono">{found}</span></div>
          ) : (
            <>
              {photoMsg && <p role={busy ? 'status' : 'alert'} className="max-w-sm text-base font-medium text-amber-300">{photoMsg}</p>}
              <div className="flex w-full max-w-xs flex-col gap-3">
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="min-h-14 rounded-xl bg-white text-lg font-bold text-black disabled:opacity-50">
                  📷 TAKE CLOSE-UP PHOTO
                </button>
                <button type="button" onClick={() => { setPhotoMsg(''); setMode('live'); }} className="min-h-14 rounded-xl border-2 border-white text-lg font-semibold">
                  Back to live scanner
                </button>
                <button type="button" onClick={onManual} className="min-h-12 text-base underline">Enter serial manually</button>
                <button type="button" onClick={onCancel} className="min-h-12 text-base underline">Cancel</button>
              </div>
            </>
          )}
        </div>
      ) : problem ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl" aria-hidden="true">🚫</p>
          <p role="alert" className="text-xl font-semibold">{problem.title}</p>
          <p className="max-w-sm text-base text-gray-200">{problem.help}</p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
            {problem.kind !== 'unsupported' && problem.kind !== 'unavailable' && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-14 rounded-xl bg-white text-lg font-bold text-black">TRY AGAIN</button>
            )}
            <button type="button" onClick={() => setMode('photo')} className="min-h-14 rounded-xl border-2 border-white text-lg font-semibold">📷 Scan from a photo instead</button>
            <button type="button" onClick={onManual} className="min-h-12 text-base underline">Enter serial manually</button>
            <button type="button" onClick={onCancel} className="min-h-12 text-base underline">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden" onClick={onTapFocus}>
            {/* playsInline + muted are required for iOS Safari */}
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`relative h-44 w-[86%] max-w-md rounded-2xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${found ? 'border-green-400' : 'border-white/90'}`}>
                {!found && !starting && <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-red-500" />}
              </div>
            </div>
            {ring && <span className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300" style={{ left: ring.x, top: ring.y }} />}
            {found && (
              <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-700/85">
                <p className="text-6xl" aria-hidden="true">✓</p>
                <p className="text-2xl font-bold">BARCODE SCANNED</p>
                <p className="break-all px-6 font-mono text-xl">{found}</p>
              </div>
            )}
            {starting && <p role="status" className="absolute inset-x-0 top-6 text-center text-base">Starting camera… allow access if asked.</p>}
          </div>

          <div className="space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-center">
            {!found && (
              <p className="text-sm text-gray-200">
                Hold the phone 10-20 cm away and <strong>tap the barcode to focus</strong>.
                {zoomLevels.length > 1 ? ' Tiny barcode? Hold it further back and use zoom.' : ' Tiny barcode? Use "Scan from photo".'}
              </p>
            )}
            {!found && assist && (
              <p role="status" className="text-sm font-semibold text-amber-300">
                Reading high-resolution photos… keep the phone steady, 15-20 cm from the barcode.
              </p>
            )}
            {!found && zoomLevels.length > 1 && (
              <div role="group" aria-label="Zoom" className="flex justify-center gap-2">
                {zoomLevels.map((z) => (
                  <button key={z} type="button" aria-pressed={zoom === z} onClick={() => changeZoom(z)} className={`min-h-12 min-w-14 rounded-xl border-2 text-lg font-bold ${zoom === z ? 'border-amber-400 bg-amber-400 text-black' : 'border-white'}`}>
                    {z}×
                  </button>
                ))}
              </div>
            )}
            {!found && info?.manualFocus && (
              <div role="group" aria-label="Focus" className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-300">Focus</span>
                {(['auto', 'close', 'mid'] as FocusPreset[]).map((f) => (
                  <button key={f} type="button" aria-pressed={focusPreset === f} onClick={() => changeFocus(f)} className={`min-h-12 flex-1 rounded-xl border-2 text-base font-semibold ${focusPreset === f ? 'border-amber-400 bg-amber-400 text-black' : 'border-white'}`}>
                    {f === 'auto' ? 'Auto' : f === 'close' ? 'Close 12 cm' : 'Mid 25 cm'}
                  </button>
                ))}
              </div>
            )}
            {!found && (
              <div className="flex gap-2">
                {info?.torch && (
                  <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className={`min-h-12 flex-1 rounded-xl border-2 text-base font-semibold ${torchOn ? 'border-amber-400 bg-amber-400 text-black' : 'border-white'}`}>
                    🔦 Torch {torchOn ? 'ON' : 'OFF'}
                  </button>
                )}
                {cams.length > 1 && (
                  <button type="button" onClick={switchCamera} className="min-h-12 flex-1 rounded-xl border-2 border-white text-base font-semibold">🔄 Switch camera</button>
                )}
              </div>
            )}
            {!found && (
              <button type="button" onClick={() => { stopStream(streamRef.current); setMode('photo'); }} className="min-h-12 w-full rounded-xl border-2 border-white text-base font-semibold">
                📷 Scan from photo (best for tiny barcodes)
              </button>
            )}
            <button type="button" onClick={onCancel} className="min-h-14 w-full rounded-xl bg-white text-lg font-bold text-black">CANCEL</button>
            {info && <p className="break-words text-[11px] leading-tight text-gray-500">{info.summary}{engine ? ` · ${engine}` : ''}</p>}
          </div>
        </>
      )}
    </div>
  );
}
