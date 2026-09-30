// Barcode decoding. NO OCR: every serial comes from a real barcode decoder.
//
// Two engines behind the standard Barcode Detection API:
//  1. NATIVE `BarcodeDetector` (Chrome on Android uses Google's ML Kit): very fast and much better
//     than JS decoders on small, blurry or angled labels.
//  2. zxing-cpp compiled to WebAssembly (via the `barcode-detector` ponyfill) everywhere else
//     (iPhone Safari/Chrome, Firefox, desktop). Bundled into the app (no CDN) so it works offline.
import { BarcodeDetector as WasmBarcodeDetector, setZXingModuleOverrides } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// Serve the decoder from our own origin instead of the default CDN.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
});

// 1D equipment labels first, then the common 2D formats.
export const FORMATS = [
  'code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e',
  'qr_code', 'data_matrix', 'pdf417', 'aztec',
] as const;

export interface Found {
  text: string;
  format: string;
}

export interface Detector {
  kind: 'native' | 'wasm';
  detect(source: ImageBitmapSource): Promise<Found[]>;
}

interface NativeCtor {
  new (opts?: { formats?: string[] }): { detect(s: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]> };
  getSupportedFormats?: () => Promise<string[]>;
}

const asFound = (r: { rawValue: string; format: string }[]): Found[] =>
  r.filter((x) => x.rawValue).map((x) => ({ text: x.rawValue, format: x.format }));

export function createWasmDetector(): Detector {
  const d = new WasmBarcodeDetector({ formats: [...FORMATS] });
  return { kind: 'wasm', detect: async (s) => asFound(await d.detect(s)) };
}

export async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? [];
      const formats = FORMATS.filter((f) => supported.includes(f));
      // Only trust the native engine if it reads the main 1D label format.
      if (formats.includes('code_128')) {
        const d = new Native({ formats });
        return { kind: 'native', detect: async (s) => asFound(await d.detect(s)) };
      }
    } catch {
      /* fall through to wasm */
    }
  }
  return createWasmDetector();
}

let photoDetector: Promise<Detector> | null = null;

/**
 * Decode a barcode from a still photo (taken with the phone's own camera app, which focuses far
 * better than a live web video stream). Tries the whole image, then overlapping tiles so a tiny
 * barcode in a big photo is still found. Returns null when nothing is found.
 */
export async function decodeImageFile(file: Blob, opts: { tiles?: boolean } = {}): Promise<Found | null> {
  photoDetector ??= createDetector();
  const detectors: Detector[] = [await photoDetector];
  if (detectors[0].kind === 'native') detectors.push(createWasmDetector()); // second opinion

  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    for (const det of detectors) {
      const whole = await det.detect(bmp).catch(() => []);
      if (whole.length) return whole[0];
    }
    if (opts.tiles === false) return null;
    // Tiles: 3x3 grid of half-size windows (50% overlap), each decoded at full resolution.
    const w = Math.floor(bmp.width / 2);
    const h = Math.floor(bmp.height / 2);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const wasm = detectors[detectors.length - 1];
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        ctx.drawImage(bmp, Math.floor((gx * (bmp.width - w)) / 2), Math.floor((gy * (bmp.height - h)) / 2), w, h, 0, 0, w, h);
        const r = await wasm.detect(canvas).catch(() => []);
        if (r.length) return r[0];
      }
    }
    return null;
  } finally {
    bmp.close?.();
  }
}
