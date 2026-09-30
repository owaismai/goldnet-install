// Shared form types. Field names/labels follow the reference WhatsForm
// ("Osama Customer Details", https://whatsform.com/g8ztfa).

export type SerialSource = 'barcode' | 'manual' | null;

/** Checkbox/radio answer, with the reference form's optional "Other" text. */
export interface Choice {
  selected: string[]; // option labels; OTHER marks the "Other" option
  other: string;
}

export const OTHER = '__other__';

export interface FormState {
  // Customer details
  fullName: string;
  email: string;
  phone: string;
  idNumber: string;
  streetAddress: string;
  // Equipment installed
  cpeModel: Choice;
  routerModel: Choice;
  // Installation
  internetService: Choice;
  startDate: string;
  installFee: Choice;
  routerSite: Choice; // reference label "Router:" (Sidwell / Kwaza/Mkwayi)
  cashCollected: Choice;
  cashReceipt: string;
  technician: string;
  // CPE (barcode-first workflow)
  cpeSerial: string;
  cpeSerialSource: SerialSource;
  cpePhoto: boolean; // the image itself lives in IndexedDB (see utils/photoStore.ts)
  // Router (barcode-first workflow)
  routerSerial: string;
  routerSerialSource: SerialSource;
  routerPhoto: boolean;
  // Details of equipment / consumables
  cableFrom: string;
  cableTo: string;
  // Quality checks
  signal: string;
  speedtest: string;
  clientType: string; // "New" | "Move over"
  photosTaken: Choice;
  rating: number; // 0 = not rated
  // Installer comments
  comments: string;
  needMore: Choice;
}

export type StepId = 'customer' | 'installation' | 'cpe' | 'router' | 'additional' | 'review';

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'installation', label: 'Installation' },
  { id: 'cpe', label: 'CPE' },
  { id: 'router', label: 'Router' },
  { id: 'additional', label: 'Additional' },
  { id: 'review', label: 'Review' },
];

const noChoice = (): Choice => ({ selected: [], other: '' });

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emptyForm(): FormState {
  return {
    fullName: '', email: '', phone: '', idNumber: '', streetAddress: '',
    cpeModel: noChoice(), routerModel: noChoice(),
    internetService: noChoice(), startDate: today(), installFee: noChoice(),
    routerSite: noChoice(), cashCollected: noChoice(), cashReceipt: '', technician: '',
    cpeSerial: '', cpeSerialSource: null, cpePhoto: false,
    routerSerial: '', routerSerialSource: null, routerPhoto: false,
    cableFrom: '', cableTo: '',
    signal: '', speedtest: '', clientType: '', photosTaken: noChoice(), rating: 0,
    comments: '', needMore: noChoice(),
  };
}

/** Human-readable text of a choice answer ("Reyee 460G, Other text"). */
export function choiceText(c: Choice): string {
  return c.selected
    .map((s) => (s === OTHER ? c.other.trim() : s))
    .filter(Boolean)
    .join(', ');
}
