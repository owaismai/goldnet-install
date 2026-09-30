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
}

export interface TrackInfo {
  /** Browser reports focus control at all (Chrome Android: yes, iOS Safari: no). */
  focusKnown: boolean;
  continuousFocus: boolean;
  tapFocus: boolean;
  torch: boolean;
  zoom: { min: number; max: number } | null;
  deviceId: string | undefined;
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
  return {
    focusKnown,
    continuousFocus,
    tapFocus: !!c.focusMode?.includes('single-shot') || continuousFocus,
    torch: !!c.torch,
    zoom: c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max } : null,
    deviceId: track.getSettings().deviceId,
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
