import type { FormState, StepId } from '../types.ts';
import { emptyForm, TECHNICIANS } from '../types.ts';

const KEY = 'goldnet-install-form-v1';

interface Saved {
  form: FormState;
  step: StepId;
}

// localStorage can throw (private mode, blocked site data): always try/catch.
export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Saved;
    // Merge over defaults so a form saved by an older version still loads.
    return { form: { ...emptyForm(), ...p.form }, step: p.step ?? 'customer' };
  } catch {
    return null;
  }
}

export function save(form: FormState, step: StepId): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ form, step }));
  } catch {
    /* ignore */
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The technician selection is remembered on this phone across installations. */
const TECH = 'goldnet-install-technician';
const valid = (n: string): boolean => (TECHNICIANS as readonly string[]).includes(n);
export const loadTechnician = (): string => {
  try {
    const n = localStorage.getItem(TECH) ?? '';
    return valid(n) ? n : '';
  } catch {
    return '';
  }
};
export const saveTechnician = (n: string): void => {
  if (!valid(n)) return; // never overwrite a remembered name with an empty/old value
  try {
    localStorage.setItem(TECH, n);
  } catch {
    /* ignore */
  }
};
