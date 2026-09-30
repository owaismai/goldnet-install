// Getting the photos into WhatsApp.
//
// A wa.me link can only carry TEXT, never files. The only way a static web app can hand images to
// WhatsApp is the phone's native share sheet (Web Share API with files): the technician picks
// WhatsApp and the same chat, then presses Send. (Fully automatic photo delivery would need a
// backend/storage service in a future version.)
import { loadPhoto } from './photoStore.ts';
import type { PhotoKey } from './photoStore.ts';

export function photoFileName(label: 'CPE' | 'Router', serial: string): string {
  const clean = serial.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${label}-${clean || 'photo'}.jpg`;
}

export async function loadPhotoFiles(cpeSerial: string, routerSerial: string): Promise<File[]> {
  const items: [PhotoKey, 'CPE' | 'Router', string][] = [
    ['cpe', 'CPE', cpeSerial],
    ['router', 'Router', routerSerial],
  ];
  const files: File[] = [];
  for (const [key, label, serial] of items) {
    const blob = await loadPhoto(key);
    if (blob) files.push(new File([blob], photoFileName(label, serial), { type: blob.type || 'image/jpeg' }));
  }
  return files;
}

export function canShareFiles(files: File[]): boolean {
  try {
    return files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files });
  } catch {
    return false;
  }
}
