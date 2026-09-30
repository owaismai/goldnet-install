import EquipmentStep from '../components/EquipmentStep.tsx';
import { DUPLICATE_WARNING, serialsIdentical } from '../utils/validation.ts';
import type { SectionProps } from './types.ts';

export default function RouterSection({ form, errors, update }: SectionProps) {
  return (
    <EquipmentStep
      label="Router" photoKey="router"
      serial={form.routerSerial} source={form.routerSerialSource} hasPhoto={form.routerPhoto}
      warning={serialsIdentical(form) ? DUPLICATE_WARNING : undefined}
      errors={errors}
      onSerial={(routerSerial, routerSerialSource) => update({ routerSerial, routerSerialSource })}
      onPhoto={(routerPhoto) => update({ routerPhoto })}
    />
  );
}
