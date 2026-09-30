import type { FormState, StepId } from '../types.ts';
import { OTHER } from '../types.ts';

export type Errors = Record<string, string>;

const REQUIRED = 'This field is required';

function choiceMissing(c: { selected: string[]; other: string }): string | null {
  if (c.selected.length === 0) return 'Please choose an option';
  if (c.selected.includes(OTHER) && !c.other.trim()) return 'Please type the "Other" value';
  return null;
}

export const DUPLICATE_WARNING =
  'Warning: CPE and Router serial numbers are identical. Please check the equipment.';

export function serialsIdentical(f: Pick<FormState, 'cpeSerial' | 'routerSerial'>): boolean {
  const a = f.cpeSerial.trim();
  return a !== '' && a === f.routerSerial.trim();
}

export function validateStep(step: StepId, f: FormState): Errors {
  const e: Errors = {};
  const need = (key: string, value: string, msg = REQUIRED) => {
    if (!value.trim()) e[key] = msg;
  };
  const needChoice = (key: string, c: FormState['cpeModel']) => {
    const m = choiceMissing(c);
    if (m) e[key] = m;
  };

  switch (step) {
    case 'customer':
      need('fullName', f.fullName);
      need('phone', f.phone);
      if (f.phone.trim() && f.phone.replace(/\D/g, '').length < 9) e.phone = 'Enter a valid phone number';
      if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
      if (f.idNumber.trim() && !/^\d+$/.test(f.idNumber.trim())) e.idNumber = 'Digits only';
      need('streetAddress', f.streetAddress);
      break;

    case 'installation':
      needChoice('cpeModel', f.cpeModel);
      needChoice('routerModel', f.routerModel);
      needChoice('internetService', f.internetService);
      need('startDate', f.startDate);
      needChoice('installFee', f.installFee);
      needChoice('routerSite', f.routerSite);
      needChoice('cashCollected', f.cashCollected);
      break;

    case 'cpe':
      need('cpeSerial', f.cpeSerial, 'Scan the CPE barcode (or enter the serial manually)');
      if (!f.cpePhoto) e.cpePhoto = 'Take and confirm the CPE photo';
      break;

    case 'router':
      need('routerSerial', f.routerSerial, 'Scan the router barcode (or enter the serial manually)');
      if (!f.routerPhoto) e.routerPhoto = 'Take and confirm the router photo';
      break;

    case 'additional':
      if (f.cableFrom.trim() && !/^\d+$/.test(f.cableFrom.trim())) e.cableFrom = 'Digits only';
      if (f.cableTo.trim() && !/^\d+$/.test(f.cableTo.trim())) e.cableTo = 'Digits only';
      need('signal', f.signal);
      if (f.signal.trim() && !/^\d+$/.test(f.signal.trim())) e.signal = 'Digits only (the minus sign is added for you)';
      need('speedtest', f.speedtest);
      if (f.speedtest.trim() && !/^\d+$/.test(f.speedtest.trim())) e.speedtest = 'Digits only';
      need('clientType', f.clientType, 'Please choose an option');
      needChoice('photosTaken', f.photosTaken);
      break;

    case 'review':
      break;
  }
  return e;
}

const ORDER: StepId[] = ['customer', 'installation', 'cpe', 'router', 'additional'];

/** Errors for every step, keyed by step. Empty object = the form may be submitted. */
export function validateAll(f: FormState): Partial<Record<StepId, Errors>> {
  const out: Partial<Record<StepId, Errors>> = {};
  for (const s of ORDER) {
    const e = validateStep(s, f);
    if (Object.keys(e).length) out[s] = e;
  }
  return out;
}
