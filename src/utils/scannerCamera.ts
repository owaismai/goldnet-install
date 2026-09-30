// Camera control for the live barcode scanner: rear-camera selection, continuous autofocus,
// tap-to-focus, zoom and torch.
//
// Why this exists: getUserMedia on many Android phones opens the camera in FIXED focus unless
// continuous focus is requested explicitly, and on multi-camera phones `facingMode: environment`
// can pick a fixed-focus ultra-wide lens. iPhone Safari exposes no focus controls at all (it
// autofocuses by itself, min distance about 10 cm). So we request what the browser allows,
// feature-detect everything, and only show controls that really work.

interface ExtCaps extends MediaTrackCapabilities {
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
}

export interface TrackInfo {
  /** Browser reports focus control at all (Chrome Android: yes, iOS Safari: no). */
  focusKnown: boolean;
  continuousFocus: boolean;
  tapFocus: boolean;
  torch: boolean;
  zoom: { min: number; max: number } | null;
  /** Manual focus distance range in metres (close-up presets), when the camera allows it. */
  manualFocus: { min: number; max: number } | null;
  deviceId: string | undefined;
  /** One line of camera facts, shown small on the scanner so problems can be diagnosed from a screenshot. */
  summary: string;
}

const caps = (t: MediaStreamTrack): ExtCaps => (t.getCapabilities?.() ?? {}) as ExtCaps;
const adv = (t: MediaStreamTrack, c: Record<string, unknown>) =>
  t.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });

/** Open the rear camera. `deviceId` (from Switch camera) overrides facingMode. */
export function openStream(deviceId?: string, width = 1920, height = 1080): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: width }, height: { ideal: height } },
  });
}

export function stopStream(s: MediaStream | null | undefined): void {
  s?.getTracks().forEach((t) => t.stop());
}

/** Ask for continuous autofocus/exposure and report what the camera can do. */
export async function tuneTrack(track: MediaStreamTrack): Promise<TrackInfo> {
  const c = caps(track);
  const focusKnown = Array.isArray(c.focusMode);
  const continuousFocus = !!c.focusMode?.includes('continuous');
  if (continuousFocus) await adv(track, { focusMode: 'continuous' }).catch(() => {});
  if (c.exposureMode?.includes('continuous')) await adv(track, { exposureMode: 'continuous' }).catch(() => {});
  if (c.whiteBalanceMode?.includes('continuous')) await adv(track, { whiteBalanceMode: 'continuous' }).catch(() => {});
  const st = track.getSettings();
  const zoom = c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max } : null;
  const manualFocus =
    c.focusMode?.includes('manual') && c.focusDistance && c.focusDistance.max > c.focusDistance.min
      ? { min: c.focusDistance.min, max: c.focusDistance.max }
      : null;
  const summary = [
    track.label || 'camera',
    st.width && st.height ? `${st.width}x${st.height}` : '',
    `focus: ${c.focusMode?.join('/') ?? 'no control'}`,
    zoom ? `zoom ${zoom.min}-${zoom.max}` : '',
    'ImageCapture' in window ? 'stills ok' : 'no stills',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    focusKnown,
    continuousFocus,
    tapFocus: !!c.focusMode?.includes('single-shot') || continuousFocus,
    torch: !!c.torch,
    zoom,
    manualFocus,
    deviceId: st.deviceId,
    summary,
  };
}

/**
 * Re-trigger autofocus at a point (x,y in 0..1 of the picture), then go back to continuous focus.
 * Uses `pointsOfInterest` where supported, otherwise a plain single-shot refocus.
 */
export async function tapFocus(track: MediaStreamTrack, x: number, y: number): Promise<void> {
  const c = caps(track);
  try {
    if (c.focusMode?.includes('single-shot')) {
      await adv(track, { focusMode: 'single-shot', pointsOfInterest: [{ x, y }] }).catch(() =>
        adv(track, { focusMode: 'single-shot' }),
      );
    } else if (c.focusMode?.includes('continuous')) {
      // No single-shot: nudge the focus loop by switching modes.
      await adv(track, { focusMode: 'manual' }).catch(() => {});
    }
  } finally {
    window.setTimeout(() => {
      if (c.focusMode?.includes('continuous')) adv(track, { focusMode: 'continuous' }).catch(() => {});
    }, 1200);
  }
}

/** Back to autofocus (null) or lock focus at a fixed distance in metres (for close-up barcodes). */
export async function setFocus(track: MediaStreamTrack, metres: number | null): Promise<void> {
  const c = caps(track);
  if (metres === null) return adv(track, { focusMode: c.focusMode?.includes('continuous') ? 'continuous' : 'single-shot' });
  const d = c.focusDistance;
  const m = d ? Math.min(Math.max(metres, d.min), d.max) : metres;
  return adv(track, { focusMode: 'manual', focusDistance: m });
}

interface ImageCaptureLike {
  takePhoto(o?: Record<string, unknown>): Promise<Blob>;
  getPhotoCapabilities(): Promise<{ imageWidth?: { max: number } }>;
}

/**
 * High-resolution still grabber (ImageCapture.takePhoto, Chrome on Android). A still runs a real
 * autofocus and uses the full sensor, like the camera app, so tiny barcodes that are too small
 * and soft in the low-resolution live preview are readable. Returns null when unsupported.
 */
export function createStillGrabber(track: MediaStreamTrack): (() => Promise<Blob>) | null {
  const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;
  if (!IC) return null;
  const ic = new IC(track);
  let opts: Record<string, unknown> | undefined;
  return async () => {
    if (!opts) {
      opts = {};
      try {
        const pc = await ic.getPhotoCapabilities();
        // about 8 MP: sharp enough for tiny labels, quick enough to decode repeatedly
        if (pc.imageWidth?.max) opts = { imageWidth: Math.min(pc.imageWidth.max, 3264) };
      } catch {
        /* use the default size */
      }
    }
    return ic.takePhoto(opts);
  };
}

export const setZoom = (t: MediaStreamTrack, z: number) => adv(t, { zoom: z });
export const setTorch = (t: MediaStreamTrack, on: boolean) => adv(t, { torch: on });

export interface Cam {
  id: string;
  label: string;
}

/** Rear cameras (labels are only available after permission was granted). */
export async function listBackCameras(): Promise<Cam[]> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const back = all.filter((d) => /back|rear|environment/i.test(d.label));
  return (back.length ? back : all).map((d) => ({ id: d.deviceId, label: d.label }));
}

/** First other rear camera that supports continuous autofocus (skips fixed-focus ultra-wide lenses). */
export async function findFocusableCamera(cams: Cam[], currentId: string | undefined): Promise<string | null> {
  for (const cam of cams) {
    if (cam.id === currentId) continue;
    let s: MediaStream | null = null;
    try {
      s = await openStream(cam.id, 1280, 720);
      if (caps(s.getVideoTracks()[0]).focusMode?.includes('continuous')) return cam.id;
    } catch {
      /* try the next one */
    } finally {
      stopStream(s);
    }
  }
  return null;
}
