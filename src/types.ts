// Shared form types. Field names/labels follow the reference WhatsForm
// ("Osama Customer Details", https://whatsform.com/g8ztfa).

/** Installers shown in the Technician dropdown (required). */
export const TECHNICIANS = ['Osama', 'Waathiq', 'Donnovan', 'Bashir', 'Team Osama'] as const;

// Packages (Splynx tariffs 74, 71, 73 for Osama; 76, 75, 71, 73 for Waathiq, who does not sell the 20mbps NB Promo; names as on 5 Oct 2026).
// Label = speed + short name + monthly price; the install bot matches the tariff by speed and price.
export const DEFAULT_PACKAGE = '20mbps NB Promo - R350pm';
const PACKAGES_OSAMA = [DEFAULT_PACKAGE, '50mbps Premium (Gold SLA) - R499pm', '100mbps Premium Business (Platinum SLA) - R2799pm'];
const PACKAGES_WAATHIQ = [
  '15mbps - R350pm', '25mbps Premium (Gold SLA) - R399pm',
  '50mbps Premium (Gold SLA) - R499pm', '100mbps Premium Business (Platinum SLA) - R2799pm',
];

/** Packages for the chosen installer: Osama / Team Osama / Bashir sell Goldnet Osama's, Waathiq / Donnovan GOLDNET Waathiq's. */
export function packagesFor(technician: string): string[] {
  if (technician === 'Waathiq' || technician === 'Donnovan') return PACKAGES_WAATHIQ;
  if (technician === 'Osama' || technician === 'Team Osama' || technician === 'Bashir') return PACKAGES_OSAMA;
  return [];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

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
  /** Set when the address came from Google Maps or the phone's location; used for the map pin in the message. */
  location: GeoPoint | null;
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
  // Customer Wi-Fi (set up on the router)
  wifiName: string;
  wifiPassword: string;
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

/** The plan pre-selected for an installer: 20mbps R350 where it is offered (Osama's side), else nothing. */
export function defaultServiceFor(technician: string): Choice {
  return { selected: packagesFor(technician).includes(DEFAULT_PACKAGE) ? [DEFAULT_PACKAGE] : [], other: '' };
}

export function emptyForm(technician = ''): FormState {
  return {
    fullName: '', email: '', phone: '', idNumber: '', streetAddress: '', location: null,
    cpeModel: noChoice(), routerModel: noChoice(),
    internetService: defaultServiceFor(technician), startDate: today(), installFee: noChoice(),
    routerSite: noChoice(), cashCollected: noChoice(), cashReceipt: '', technician,
    cpeSerial: '', cpeSerialSource: null, cpePhoto: false,
    routerSerial: '', routerSerialSource: null, routerPhoto: false,
    wifiName: '', wifiPassword: '',
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
