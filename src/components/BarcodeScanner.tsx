import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { createReader } from '../utils/barcode.ts';
import { normaliseSerial } from '../utils/serial.ts';
import { describeCameraError } from '../utils/camera.ts';
import type { CameraProblem } from '../utils/camera.ts';

interface Props {
  title: string; // e.g. "SCAN CPE BARCODE"
  onResult: (value: string, format: string) => void;
  onCancel: () => void;
  onManual: () => void;
}

// Require the same value on two consecutive decodes: filters one-off misreads.
const CONFIRM_READS = 2;

/**
 * Full-screen rear-camera scanner. Mounted only after the technician presses a
 * SCAN button, so the permission prompt never appears unprompted. Detects
 * automatically (no capture button), vibrates, then stops the camera and closes.
 */
export default function BarcodeScanner({ title, onResult, onCancel, onManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [starting, setStarting] = useState(true);
  const [found, setFound] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // keep latest callbacks without restarting the camera
  const cb = useRef({ onResult });
  cb.current = { onResult };

  useEffect(() => {
    let cancelled = false;
    let last = '';
    let count = 0;
    let done = false;
    setProblem(null);
    setStarting(true);

    const stop = () => {
      try {
        controlsRef.current?.stop();
      } catch {
        /* already stopped */
      }
      controlsRef.current = null;
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
        const reader = createReader();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' }, // rear camera
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current!,
          (result) => {
            if (!result || done || cancelled) return;
            const text = normaliseSerial(result.getText());
            if (!text) return;
            if (text === last) count += 1;
            else {
              last = text;
              count = 1;
            }
            if (count < CONFIRM_READS) return;
            done = true;
            try {
              navigator.vibrate?.(200);
            } catch {
              /* unsupported */
            }
            stop(); // close the camera straight away
            setFound(text);
            // brief success feedback, then hand the value back
            window.setTimeout(() => cb.current.onResult(text, String(result.getBarcodeFormat())), 650);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);

        const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
        if (track) {
          const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
          setTorchOk(!!caps.torch);
          if (caps.focusMode?.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
          }
        }
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setProblem(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [attempt]);

  async function toggleTorch() {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchOk(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <h2 className="px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-center text-xl font-bold tracking-wide">{title}</h2>

      {problem ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl" aria-hidden="true">🚫</p>
          <p role="alert" className="text-xl font-semibold">{problem.title}</p>
          <p className="max-w-sm text-base text-gray-200">{problem.help}</p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
            {problem.kind !== 'unsupported' && problem.kind !== 'unavailable' && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-14 rounded-xl bg-white text-lg font-bold text-black">
                TRY AGAIN
              </button>
            )}
            <button type="button" onClick={onManual} className="min-h-14 rounded-xl border-2 border-white text-lg font-semibold">
              Enter serial manually
            </button>
            <button type="button" onClick={onCancel} className="min-h-12 text-base underline">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden">
            {/* playsInline + muted are required for iOS Safari */}
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative h-44 w-[86%] max-w-md rounded-2xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${
                  found ? 'border-green-400' : 'border-white/90'
                }`}
              >
                {!found && !starting && <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-red-500" />}
              </div>
            </div>
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
            <p className="text-base text-gray-200">Position the barcode inside the frame</p>
            <div className="flex gap-3">
              {torchOk && !found && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-pressed={torchOn}
                  className={`min-h-14 flex-1 rounded-xl border-2 text-lg font-semibold ${torchOn ? 'border-amber-400 bg-amber-400 text-black' : 'border-white'}`}
                >
                  🔦 Flashlight {torchOn ? 'ON' : 'OFF'}
                </button>
              )}
              <button type="button" onClick={onCancel} className="min-h-14 flex-1 rounded-xl bg-white text-lg font-bold text-black">
                CANCEL
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
