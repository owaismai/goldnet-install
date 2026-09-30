import EquipmentStep from '../components/EquipmentStep.tsx';
import type { SectionProps } from './types.ts';

export default function CPESection({ form, errors, update }: SectionProps) {
  return (
    <EquipmentStep
      label="CPE" photoKey="cpe"
      serial={form.cpeSerial} source={form.cpeSerialSource} hasPhoto={form.cpePhoto}
      errors={errors}
      onSerial={(cpeSerial, cpeSerialSource) => update({ cpeSerial, cpeSerialSource })}
      onPhoto={(cpePhoto) => update({ cpePhoto })}
    />
  );
}
