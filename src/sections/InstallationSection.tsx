import { Card, ChoiceField, SectionHeader, SelectField, TextField } from '../components/Fields.tsx';
import { defaultServiceFor, OTHER, packagesFor, TECHNICIANS } from '../types.ts';
import type { SectionProps } from './types.ts';

export const CPE_MODELS = ['Reyee 460G', 'Reyee 460F', 'Cambium 4525L'];
export const ROUTER_MODELS = ['Mikrotik HAP ac2', 'M1300 AC', 'M1200 AC', 'M3000 AX'];

export default function InstallationSection({ form, errors, update }: SectionProps) {
  const packages = packagesFor(form.technician);
  // Changing installer changes the plans on offer: a plan that is not offered to the new one goes back to its default.
  const changeTechnician = (technician: string) => {
    const offered = packagesFor(technician);
    const { selected } = form.internetService;
    const kept = selected.length > 0 && selected.every((s) => s === OTHER || offered.includes(s));
    update(kept ? { technician } : { technician, internetService: defaultServiceFor(technician) });
  };
  return (
    <>
      <Card>
        <SectionHeader>Technician</SectionHeader>
        <SelectField
          label="Technician" required options={TECHNICIANS} placeholder="Select your name…"
          hint="Remembered on this phone"
          value={form.technician} error={errors.technician} onChange={changeTechnician}
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
          label="Internet Service:" required allowOther options={packages}
          hint={packages.length ? undefined : 'Select the installer first to see the plans'}
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
