import type { FormState } from '../types.ts';
import type { Errors } from '../utils/validation.ts';

export interface SectionProps {
  form: FormState;
  errors: Errors;
  update: (patch: Partial<FormState>) => void;
}
