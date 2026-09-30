import { STEPS } from '../types.ts';

interface Props {
  current: number; // index into STEPS
  onJump: (index: number) => void; // only called for completed (earlier) steps
}

export default function ProgressIndicator({ current, onJump }: Props) {
  return (
    <nav aria-label="Progress" className="bg-white px-3 pb-3 pt-2 shadow-sm">
      <p className="text-center text-sm font-medium text-gray-700">
        Step {current + 1} of {STEPS.length}: <span className="font-semibold text-brand-dark">{STEPS[current].label}</span>
      </p>
      <ol className="mt-2 flex items-start justify-between">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const dot = (
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? 'bg-brand text-white ring-4 ring-teal-200'
                  : done
                    ? 'bg-brand text-white'
                    : 'border-2 border-gray-400 bg-white text-gray-600'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
          );
          return (
            <li key={s.id} className="flex flex-1 flex-col items-center" aria-current={active ? 'step' : undefined}>
              {done ? (
                <button type="button" onClick={() => onJump(i)} aria-label={`Go back to ${s.label}`} className="rounded-full">
                  {dot}
                </button>
              ) : (
                dot
              )}
              <span className={`mt-1 text-[11px] leading-tight ${active ? 'font-bold text-brand-dark' : 'text-gray-600'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
