import { Card, SectionHeader, TextField } from '../components/Fields.tsx';
import AddressField from '../components/AddressField.tsx';
import type { SectionProps } from './types.ts';
import { normalizeCell, prettyCell, tidyCell } from '../utils/phone.ts';

export default function CustomerSection({ form, errors, update }: SectionProps) {
  return (
    <Card>
      <SectionHeader>Customer details</SectionHeader>
      <TextField label="Full Name" required autoComplete="name" value={form.fullName} error={errors.fullName} onChange={(v) => update({ fullName: v })} />
      <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} error={errors.email} onChange={(v) => update({ email: v })} />
      <TextField
        label="Customer's cell number"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="068 174 6016"
        value={form.phone}
        error={errors.phone}
        hint={cellHint(form.phone)}
        onChange={(v) => update({ phone: tidyCell(v) })}
      />
      <TextField label="ID Number" inputMode="numeric" value={form.idNumber} error={errors.idNumber} onChange={(v) => update({ idNumber: v })} />
      <AddressField value={form.streetAddress} location={form.location} error={errors.streetAddress} onChange={(streetAddress, location) => update({ streetAddress, location })} />
    </Card>
  );
}

/** Live help under the cell field: what is still missing, or a tick once the number is complete. */
function cellHint(raw: string): string {
  const cell = normalizeCell(raw);
  if (cell) return `✓ ${prettyCell(cell)} (the welcome WhatsApp goes here)`;
  const n = raw.replace(/\D/g, '').length;
  return n ? `${n} digit${n === 1 ? '' : 's'} so far: 10 needed. +27 or spaces are fine.` : 'Any way works: 068 174 6016, +27 68 174 6016, 0681746016';
}
