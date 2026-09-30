// Camera helpers. The camera is only ever opened after the technician presses
// a SCAN or TAKE PHOTO button.

export type CameraErrorKind = 'denied' | 'unavailable' | 'unsupported' | 'busy' | 'failed';

export interface CameraProblem {
  kind: CameraErrorKind;
  title: string;
  help: string;
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function describeCameraError(err: unknown): CameraProblem {
  if (!cameraSupported()) {
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    return {
      kind: 'unsupported',
      title: 'Camera scanning is not supported here',
      help: insecure
        ? 'The camera only works on a secure (https) page. Open the https link of this app, or enter the serial manually.'
        : 'This browser cannot open the camera for scanning. Try Chrome (Android) or Safari (iPhone), or enter the serial manually.',
    };
  }
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return {
        kind: 'denied',
        title: 'Camera permission was denied',
        help:
          'Allow camera access for this site: tap the lock/tune icon in the address bar → Permissions → Camera → Allow, then try again. ' +
          'On iPhone: Settings → Safari → Camera → Ask or Allow (and reload the page). You can also enter the serial manually.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return {
        kind: 'unavailable',
        title: 'No camera found',
        help: 'This device has no usable camera. Enter the serial manually instead.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'busy',
        title: 'The camera is busy',
        help: 'Another app or tab is using the camera. Close it and try again.',
      };
    default:
      return {
        kind: 'failed',
        title: 'The scanner could not start',
        help: `Something went wrong opening the camera${name ? ` (${name})` : ''}. Try again, or enter the serial manually.`,
      };
  }
}

/**
 * Downscale + JPEG-compress a photo so it does not eat phone memory, while
 * keeping equipment labels readable (longest side 1600 px, quality 0.82).
 */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    // imageOrientation: honours EXIF rotation so portrait photos are not sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = null;
  }
  if (!bitmap) return file; // very old browser: keep the original rather than fail

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return blob ?? file;
}
