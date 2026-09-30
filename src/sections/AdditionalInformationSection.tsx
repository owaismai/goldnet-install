import { useEffect } from 'react';
import { Card, ChoiceField, SectionHeader, StarRating, TextField } from '../components/Fields.tsx';
import type { SectionProps } from './types.ts';

export default function AdditionalInformationSection({ form, errors, update }: SectionProps) {
  // The CPE photo was taken in the CPE step, so pre-tick it (the technician can change it).
  useEffect(() => {
    if (form.cpePhoto && form.photosTaken.selected.length === 0) {
      update({ photosTaken: { selected: ['CPE'], other: '' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Card>
        <SectionHeader>Customer Wi-Fi</SectionHeader>
        <TextField label="Wi-Fi Name" hint="The network name (SSID) set on the customer's router" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.wifiName} onChange={(v) => update({ wifiName: v })} />
        <TextField label="Wi-Fi Password" hint="Shown as typed so you can check it" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.wifiPassword} onChange={(v) => update({ wifiPassword: v })} />
      </Card>
      <Card>
        <SectionHeader>Details of Equipment/Consumables</SectionHeader>
        <TextField label="Cable used, From" inputMode="numeric" value={form.cableFrom} error={errors.cableFrom} onChange={(v) => update({ cableFrom: v })} />
        <TextField label="To" inputMode="numeric" value={form.cableTo} error={errors.cableTo} onChange={(v) => update({ cableTo: v })} />
      </Card>
      <Card>
        <SectionHeader>Quality Checks</SectionHeader>
        <TextField label="Signal" required inputMode="numeric" prefix="-" suffix="dBm" value={form.signal} error={errors.signal} onChange={(v) => update({ signal: v.replace(/^-/, '') })} />
        <TextField label="Speedtest Result" required inputMode="numeric" suffix="mbps" value={form.speedtest} error={errors.speedtest} onChange={(v) => update({ speedtest: v })} />
        <ChoiceField
          label="New client or Move over" required options={['New', 'Move over']}
          value={{ selected: form.clientType ? [form.clientType] : [], other: '' }}
          error={errors.clientType}
          onChange={(v) => update({ clientType: v.selected[0] ?? '' })}
        />
        <ChoiceField
          label="Photos taken" required multiple allowOther options={['CPE', 'Mesh']}
          hint="Choose Other, and type reason if photos are not available"
          value={form.photosTaken} error={errors.photosTaken} onChange={(v) => update({ photosTaken: v })}
        />
        <StarRating label="Client Satisfaction" hint="Ask client to rate the Installation and initial performance" value={form.rating} onChange={(rating) => update({ rating })} />
      </Card>
      <Card>
        <SectionHeader>Installer Comments</SectionHeader>
        <TextField label="Comments" multiline hint="Add any comments or additional charges here" value={form.comments} onChange={(v) => update({ comments: v })} />
        <ChoiceField
          label="Stock" multiple allowOther options={['I need more Cable', 'I need more RJ45s']}
          hint="Check if you have less than 100m Cable or less than 20 RJ45s"
          value={form.needMore} onChange={(v) => update({ needMore: v })}
        />
      </Card>
    </>
  );
}
