import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Choice } from '../types.ts';
import { OTHER } from '../types.ts';

export function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-5">{children}</section>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-brand-dark border-b border-gray-200 pb-2">{children}</h2>;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

type InputProps = Omit<FieldProps, 'children'>;

export function Field({ label, required, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div data-error={error ? 'true' : undefined}>
      <label htmlFor={htmlFor} className="block text-base font-medium text-gray-900">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && <p className="mt-0.5 text-sm text-gray-600">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'block w-full min-h-12 rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-500 focus:border-brand';

interface TextProps extends InputProps {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
  autoComplete?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  prefix?: string;
  suffix?: string;
  multiline?: boolean;
  placeholder?: string;
}

export function TextField({
  label, required, hint, error, value, onChange, type = 'text', inputMode, autoComplete, autoCapitalize, spellCheck,
  prefix, suffix, multiline, placeholder,
}: TextProps) {
  const id = useId();
  const common = {
    id,
    value,
    placeholder,
    'aria-invalid': !!error,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      {multiline ? (
        <textarea {...common} rows={4} className={inputCls} />
      ) : (
        <div className="flex items-stretch gap-2">
          {prefix && <span className="flex items-center text-lg font-semibold text-gray-700">{prefix}</span>}
          <input {...common} type={type} inputMode={inputMode} autoComplete={autoComplete} autoCapitalize={autoCapitalize} spellCheck={spellCheck} className={inputCls} />
          {suffix && <span className="flex items-center text-gray-700">{suffix}</span>}
        </div>
      )}
    </Field>
  );
}

interface ChoiceProps extends InputProps {
  options: string[];
  value: Choice;
  onChange: (v: Choice) => void;
  multiple?: boolean;
  allowOther?: boolean;
}

/** Radio (single) or checkbox (multiple) list, with the reference form's optional "Other". */
export function ChoiceField({ label, required, hint, error, options, value, onChange, multiple, allowOther }: ChoiceProps) {
  const name = useId();
  const all = allowOther ? [...options, OTHER] : options;
  const toggle = (opt: string) => {
    const has = value.selected.includes(opt);
    let selected: string[];
    if (multiple) selected = has ? value.selected.filter((s) => s !== opt) : [...value.selected, opt];
    else selected = [opt];
    onChange({ ...value, selected });
  };
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className="space-y-2">
        {all.map((opt) => {
          const checked = value.selected.includes(opt);
          const text = opt === OTHER ? 'Other' : opt;
          return (
            <label
              key={opt}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-base ${
                checked ? 'border-brand bg-teal-50 ring-1 ring-brand' : 'border-gray-300 bg-white'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                checked={checked}
                onChange={() => toggle(opt)}
                className="h-5 w-5 shrink-0 accent-teal-700"
              />
              <span>{text}</span>
            </label>
          );
        })}
        {allowOther && value.selected.includes(OTHER) && (
          <input
            type="text"
            aria-label={`${label} other`}
            placeholder="Type here"
            value={value.other}
            onChange={(e) => onChange({ ...value, other: e.target.value })}
            className={inputCls}
          />
        )}
      </div>
    </Field>
  );
}

export function StarRating({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label} hint={hint}>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(value === n ? 0 : n)}
            className={`h-12 w-12 text-4xl leading-none ${n <= value ? 'text-amber-500' : 'text-gray-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    </Field>
  );
}
