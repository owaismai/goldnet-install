// The pure parts of sending to the panel (utils/panel.ts), kept free of build-time config so the tests can load them.
import type { FormState } from '../types.ts';

/** The key in a link's #key=... part, or ''. */
export function keyFromHash(hash: string): string {
  const m = /(?:^#|&)key=([^&]+)/.exec(hash || '');
  const key = m ? decodeURIComponent(m[1]).trim() : '';
  return /^gif_[A-Za-z0-9_-]{16,80}$/.test(key) ? key : '';
}

export interface PanelAnswer {
  ok: boolean;
  id: number;
  status: 'sent' | 'failed' | 'received' | 'refused';
  message: string;
}

export interface PanelPhoto {
  field: 'cpe_photo' | 'router_photo';
  file: Blob;
  name: string;
}

/** The multipart body: "form" = {uid, message, fields}, then each photo. */
export function panelBody(uid: string, message: string, form: FormState, photos: PanelPhoto[]): FormData {
  const body = new FormData();
  body.append('form', JSON.stringify({ uid, message, fields: form }));
  for (const p of photos) body.append(p.field, p.file, p.name);
  return body;
}

