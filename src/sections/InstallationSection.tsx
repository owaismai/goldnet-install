import { Card, ChoiceField, SectionHeader, SelectField, TextField } from '../components/Fields.tsx';
import { TECHNICIANS } from '../types.ts';
import type { SectionProps } from './types.ts';

export const CPE_MODELS = ['Reyee 460G', 'Reyee 460F', 'Cambium 4525L'];
// Packages in use on the GOLDNET Osama / Waathiq networks (Splynx tariffs 76, 72, 74, 75, 71, 73; names as on 5 Oct 2026).
// Label = speed + short name + monthly price; the install bot matches the tariff by speed and price.
export const INTERNET_PACKAGES = [
  '15mbps - R350pm', '20mbps Apartment Promo - R250pm', '20mbps NB Promo - R350pm',
  '25mbps Premium (Gold SLA) - R399pm', '50mbps Premium (Gold SLA) - R499pm',
  '100mbps Premium Business (Platinum SLA) - R2799pm',
];
export const ROUTER_MODELS = ['Mikrotik HAP ac2', 'M1300 AC', 'M1200 AC', 'M3000 AX'];

export default function InstallationSection({ form, errors, update }: SectionProps) {
  return (
    <>
      <Card>
        <SectionHeader>Technician</SectionHeader>
        <SelectField
          label="Technician" required options={TECHNICIANS} placeholder="Select your name…"
          hint="Remembered on this phone"
          value={form.technician} error={errors.technician} onChange={(v) => update({ technician: v })}
        />
      </Card>
      <Card>
        <SectionHeader>Equipment installed</SectionHeader>
        <ChoiceField
          label="CPE:" required multiple allowOther options={CPE_MODELS}
          hint="Choose Other if CPE not listed or there is no CPE. (Client connected to Netpower or similar)"
          value={form.cpeModel} error={errors.cpeModel} onChange={(v) => update({ cpeModel: v })}
        />
        <ChoiceField
          label="Router Model:" required multiple allowOther options={ROUTER_MODELS}
          value={form.routerModel} error={errors.routerModel} onChange={(v) => update({ routerModel: v })}
        />
      </Card>
      <Card>
        <SectionHeader>Installation</SectionHeader>
        <ChoiceField
          label="Internet Service:" required allowOther options={INTERNET_PACKAGES}
          value={form.internetService} error={errors.internetService} onChange={(v) => update({ internetService: v })}
        />
        <TextField label="Start Date" required type="date" value={form.startDate} error={errors.startDate} onChange={(v) => update({ startDate: v })} />
        <ChoiceField
          label="Installation fee:" required allowOther options={['R250', 'Free installation']}
          value={form.installFee} error={errors.installFee} onChange={(v) => update({ installFee: v })}
        />
        <ChoiceField
          label="Router:" required options={['Sidwell', 'Kwaza/Mkwayi']}
          value={form.routerSite} error={errors.routerSite} onChange={(v) => update({ routerSite: v })}
        />
        <ChoiceField
          label="Cash Collected" required allowOther options={['Yes, R600', 'No, client will do bank payment']}
          value={form.cashCollected} error={errors.cashCollected} onChange={(v) => update({ cashCollected: v })}
        />
        <TextField label="Cash Receipt Number" value={form.cashReceipt} onChange={(v) => update({ cashReceipt: v })} />
      </Card>
    </>
  );
}
