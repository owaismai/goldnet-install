// Sending the form straight to GOLDNET ISP Manager (isp.vcom, 25 Oct 2026) instead of opening WhatsApp.
//
// Each installer opens their own link once (https://.../goldnet-install/#key=gif_...): the key is kept on this phone
// and sent with every form. The panel keeps the form and photos and hands them to the team bot, which sets the customer
// up in Splynx exactly as for a WhatsApp form and answers the installer on WhatsApp. Without a key (or if the panel
// can't be reached) the old WhatsApp way still works.
import { PANEL_URL } from '../config.ts';
import { keyFromHash } from './panelForm.ts';
import type { PanelAnswer } from './panelForm.ts';

export { panelBody } from './panelForm.ts';
export type { PanelAnswer, PanelPhoto } from './panelForm.ts';

const KEY = 'goldnet-install-key';
const UID = 'goldnet-install-uid';

/** On start: a #key=... link is saved on the phone and taken out of the address bar. */
export function captureKeyFromUrl(): void {
  try {
    const key = keyFromHash(window.location.hash);
    if (!key) return;
    localStorage.setItem(KEY, key);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* private mode: the WhatsApp way still works */
  }
}

export function loadKey(): string {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function forgetKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** One id per installation: sending the same form twice (no signal on the answer) makes one customer, not two. */
export function formUid(): string {
  try {
    let uid = localStorage.getItem(UID);
    if (!uid) {
      uid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9-]/g, '');
      localStorage.setItem(UID, uid);
    }
    return uid;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function clearUid(): void {
  try {
    localStorage.removeItem(UID);
  } catch {
    /* ignore */
  }
}

const url = (path: string) => `${PANEL_URL.replace(/\/+$/, '')}/api/public/install-form${path}`;

async function errorText(r: Response): Promise<string> {
  try {
    const j = await r.json();
    return j.error || j.message || `The panel answered ${r.status}`;
  } catch {
    return `The panel answered ${r.status}`;
  }
}

/** Who this phone sends as (the panel's name for the key); null when the key is not valid any more. */
export async function whoAmI(key: string): Promise<string | null> {
  const r = await fetch(url('/me'), { headers: { authorization: `Bearer ${key}` } });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(await errorText(r));
  return (await r.json()).name as string;
}

export async function sendToPanel(key: string, body: FormData): Promise<PanelAnswer> {
  const r = await fetch(url('/submit'), { method: 'POST', headers: { authorization: `Bearer ${key}` }, body });
  if (!r.ok) throw Object.assign(new Error(await errorText(r)), { status: r.status });
  return (await r.json()) as PanelAnswer;
}
