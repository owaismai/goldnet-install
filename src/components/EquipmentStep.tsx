import { Card, SectionHeader } from './Fields.tsx';
import SerialNumberField from './SerialNumberField.tsx';
import PhotoCapture from './PhotoCapture.tsx';
import type { SerialSource } from '../types.ts';
import type { PhotoKey } from '../utils/photoStore.ts';

interface Props {
  label: 'CPE' | 'Router';
  photoKey: PhotoKey;
  serial: string;
  source: SerialSource;
  hasPhoto: boolean;
  warning?: string;
  errors: Record<string, string>;
  onSerial: (serial: string, source: SerialSource) => void;
  onPhoto: (has: boolean) => void;
}

/** Shared CPE / Router workflow: scan barcode -> serial shown -> take photo -> confirm -> continue. */
export default function EquipmentStep({ label, photoKey, serial, source, hasPhoto, warning, errors, onSerial, onPhoto }: Props) {
  const key = label.toLowerCase();
  return (
    <Card>
      <SectionHeader>{label}</SectionHeader>
      <div data-error={errors[`${key}Serial`] ? 'true' : undefined}>
        <SerialNumberField label={label} serial={serial} source={source} onChange={onSerial} error={errors[`${key}Serial`]} />
      </div>
      {warning && (
        <p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-base font-medium text-amber-900">
          ⚠ {warning}
        </p>
      )}
      {serial && (
        <div data-error={errors[`${key}Photo`] ? 'true' : undefined} className="border-t border-gray-200 pt-4">
          <PhotoCapture photoKey={photoKey} label={label} onChange={onPhoto} error={errors[`${key}Photo`]} />
        </div>
      )}
      {!serial && !hasPhoto && <p className="text-sm text-gray-600">Scan the barcode first; the photo step follows.</p>}
    </Card>
  );
}
