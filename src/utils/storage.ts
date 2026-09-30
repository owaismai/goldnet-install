import type { FormState, StepId } from '../types.ts';
import { emptyForm } from '../types.ts';

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

/** Technician name is remembered across installations. */
const TECH = 'goldnet-install-technician';
export const loadTechnician = (): string => {
  try {
    return localStorage.getItem(TECH) ?? '';
  } catch {
    return '';
  }
};
export const saveTechnician = (n: string): void => {
  try {
    localStorage.setItem(TECH, n);
  } catch {
    /* ignore */
  }
};
