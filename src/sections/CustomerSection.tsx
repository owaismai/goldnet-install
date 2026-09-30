import { Card, SectionHeader, TextField } from '../components/Fields.tsx';
import AddressField from '../components/AddressField.tsx';
import type { SectionProps } from './types.ts';

export default function CustomerSection({ form, errors, update }: SectionProps) {
  return (
    <Card>
      <SectionHeader>Customer details</SectionHeader>
      <TextField label="Full Name" required autoComplete="name" value={form.fullName} error={errors.fullName} onChange={(v) => update({ fullName: v })} />
      <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} error={errors.email} onChange={(v) => update({ email: v })} />
      <TextField label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} error={errors.phone} onChange={(v) => update({ phone: v })} />
      <TextField label="ID Number" inputMode="numeric" value={form.idNumber} error={errors.idNumber} onChange={(v) => update({ idNumber: v })} />
      <AddressField value={form.streetAddress} location={form.location} error={errors.streetAddress} onChange={(streetAddress, location) => update({ streetAddress, location })} />
    </Card>
  );
}
