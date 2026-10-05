import { useCallback, useEffect, useRef, useState } from 'react';
import ProgressIndicator from './components/ProgressIndicator.tsx';
import CustomerSection from './sections/CustomerSection.tsx';
import InstallationSection from './sections/InstallationSection.tsx';
import CPESection from './sections/CPESection.tsx';
import RouterSection from './sections/RouterSection.tsx';
import AdditionalInformationSection from './sections/AdditionalInformationSection.tsx';
import ReviewSection from './sections/ReviewSection.tsx';
import { emptyForm, STEPS, TECHNICIANS } from './types.ts';
import type { FormState, StepId } from './types.ts';
import { validateStep } from './utils/validation.ts';
import { clearSaved, loadSaved, loadTechnician, save, saveTechnician } from './utils/storage.ts';
import { clearPhotos } from './utils/photoStore.ts';

function initial(): { form: FormState; step: StepId } {
  const saved = loadSaved();
  if (saved) {
    // a draft from before the dropdown may hold a free-text name: fall back to the remembered choice
    if (!(TECHNICIANS as readonly string[]).includes(saved.form.technician)) saved.form.technician = loadTechnician();
    return saved;
  }
  return { form: emptyForm(loadTechnician()), step: 'customer' };
}

export default function App() {
  const [{ form, step }, setState] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const topRef = useRef<HTMLDivElement>(null);

  const index = STEPS.findIndex((s) => s.id === step);
  const errors = attempted ? validateStep(step, form) : {};

  // Persist text fields so an accidental refresh does not lose the form.
  useEffect(() => save(form, step), [form, step]);
  useEffect(() => saveTechnician(form.technician), [form.technician]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const update = useCallback((patch: Partial<FormState>) => setState((s) => ({ ...s, form: { ...s.form, ...patch } })), []);

  const goto = (id: StepId) => {
    setAttempted(false);
    setState((s) => ({ ...s, step: id }));
    window.scrollTo({ top: 0 });
    topRef.current?.focus();
  };

  function next() {
    const e = validateStep(step, form);
    if (Object.keys(e).length) {
      setAttempted(true);
      // bring the first problem into view
      requestAnimationFrame(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    goto(STEPS[index + 1].id);
  }

  async function startNew() {
    clearSaved();
    await clearPhotos();
    setAttempted(false);
    setState({ form: emptyForm(loadTechnician()), step: 'customer' });
    window.scrollTo({ top: 0 });
  }

  const sectionProps = { form, errors, update };
  const errorCount = Object.keys(errors).length;

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="sticky top-0 z-20">
        <div className="bg-brand px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
          <h1 className="text-lg font-bold">GOLDNET Installation Form</h1>
        </div>
        <ProgressIndicator current={index} onJump={(i) => goto(STEPS[i].id)} />
        {!online && (
          <p role="status" className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
            You are offline. You can fill in the form, but WhatsApp needs a connection to send.
          </p>
        )}
      </header>

      <main className="space-y-4 px-3 pt-4">
        <div ref={topRef} tabIndex={-1} className="outline-none" />
        {errorCount > 0 && (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 font-semibold text-red-800">
            Please fix the {errorCount} highlighted item{errorCount > 1 ? 's' : ''} below before continuing.
          </p>
        )}
        {step === 'customer' && <CustomerSection {...sectionProps} />}
        {step === 'installation' && <InstallationSection {...sectionProps} />}
        {step === 'cpe' && <CPESection {...sectionProps} />}
        {step === 'router' && <RouterSection {...sectionProps} />}
        {step === 'additional' && <AdditionalInformationSection {...sectionProps} />}
        {step === 'review' && <ReviewSection form={form} onEdit={goto} onNew={startNew} />}
      </main>

      {step !== 'review' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-xl gap-3">
            {index > 0 && (
              <button type="button" onClick={() => goto(STEPS[index - 1].id)} className="min-h-14 flex-1 rounded-xl border-2 border-gray-400 bg-white text-lg font-semibold">
                Back
              </button>
            )}
            <button type="button" onClick={next} className="min-h-14 flex-[2] rounded-xl bg-brand text-lg font-bold text-white active:bg-brand-dark">
              {step === 'additional' ? 'REVIEW' : 'CONTINUE'}
            </button>
          </div>
        </div>
      )}
      {step === 'review' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-xl">
            <button type="button" onClick={() => goto('additional')} className="min-h-12 w-full rounded-xl border-2 border-gray-400 bg-white text-base font-semibold">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
