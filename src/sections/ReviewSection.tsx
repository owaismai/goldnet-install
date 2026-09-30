import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card, SectionHeader } from '../components/Fields.tsx';
import { choiceText, STEPS } from '../types.ts';
import type { FormState, StepId } from '../types.ts';
import { DUPLICATE_WARNING, serialsIdentical, validateAll } from '../utils/validation.ts';
import { buildMessage, buildWhatsAppUrl } from '../utils/whatsapp.ts';
import { WHATSAPP_NUMBER } from '../config.ts';
import PhotoShare from '../components/PhotoShare.tsx';

interface Props {
  form: FormState;
  onEdit: (step: StepId) => void;
  onNew: () => void;
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-base">
      <dt className="text-gray-600">{k}</dt>
      <dd className="text-right font-medium break-words">{v || '-'}</dd>
    </div>
  );
}

function Equip({ name, serial, source, photo, model }: { name: string; serial: string; source: string | null; photo: boolean; model: string }) {
  return (
    <div className="space-y-1">
      <h3 className="font-bold">{name}</h3>
      <p className={source === 'barcode' ? 'text-green-800' : 'text-amber-800'}>{source === 'barcode' ? '✓ Barcode scanned' : '✎ Entered manually'}</p>
      <p className="text-sm text-gray-600">Serial:</p>
      <p className="break-all font-mono text-lg font-semibold">{serial || '-'}</p>
      <p className={photo ? 'text-green-800' : 'text-red-700'}>{photo ? '✓ Photo captured' : '✗ Photo missing'}</p>
      <p className="text-sm text-gray-600">Model: {model || '-'}</p>
    </div>
  );
}

type Phase = 'review' | 'sent';

export default function ReviewSection({ form, onEdit, onNew }: Props) {
  const [phase, setPhase] = useState<Phase>('review');
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const problems = validateAll(form);
  const missing = Object.entries(problems) as [StepId, Record<string, string>][];
  const message = buildMessage(form);
  const url = buildWhatsAppUrl(WHATSAPP_NUMBER, message);

  function openWhatsApp() {
    setShowFallback(false);
    let hidden = false;
    const onVis = () => { if (document.hidden) hidden = true; };
    document.addEventListener('visibilitychange', onVis);
    // wa.me opens the WhatsApp app (or WhatsApp Web). Must run inside the tap handler.
    window.location.href = url;
    // If the page is still in the foreground after a moment, WhatsApp did not open.
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onVis);
      if (!hidden) setShowFallback(true);
    }, 3000);
  }

  function submit() {
    if (missing.length) return;
    setPhase('sent');
    openWhatsApp();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (phase === 'sent') {
    return (
      <Card>
        <p role="status" className="text-2xl font-bold text-green-800">✓ INSTALLATION READY</p>
        {!showFallback ? (
          <p className="text-lg">Opening WhatsApp…</p>
        ) : (
          <p role="alert" className="text-lg font-semibold text-red-700">WhatsApp could not be opened.</p>
        )}
        <p className="text-base text-gray-700">
          WhatsApp opens with the message ready for +{WHATSAPP_NUMBER}. <strong>Press Send in WhatsApp</strong> to finish. The app does not send it for you, and WhatsApp needs an internet connection.
        </p>
        <a href={url} className="flex min-h-16 w-full items-center justify-center rounded-xl bg-green-600 text-lg font-bold text-white">
          OPEN WHATSAPP
        </a>
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Message (copy it manually if needed):</p>
          <textarea readOnly value={message} rows={12} className="block w-full rounded-xl border border-gray-300 bg-gray-50 p-3 font-mono text-sm" aria-label="Generated WhatsApp message" />
          <button type="button" onClick={copy} className="mt-2 min-h-12 w-full rounded-xl border-2 border-gray-400 bg-white text-base font-semibold">
            {copied ? '✓ Copied' : 'Copy message'}
          </button>
        </div>
        <div className="space-y-2 rounded-xl border-2 border-green-600 bg-green-50 p-3">
          <p className="text-base font-bold text-green-900">Step 2: send the photos</p>
          <p className="text-sm text-gray-800">
            WhatsApp links can only carry text, so the photos go separately. Tap the button, choose <strong>WhatsApp</strong>, then the
            <strong> same chat</strong> (+{WHATSAPP_NUMBER}), and press Send.
          </p>
          <PhotoShare customer={form.fullName} cpeSerial={form.cpeSerial} routerSerial={form.routerSerial} />
        </div>
        <button type="button" onClick={() => setPhase('review')} className="min-h-12 w-full text-base underline">
          ← Back to review
        </button>
        <button type="button" onClick={onNew} className="min-h-12 w-full rounded-xl border-2 border-brand bg-white text-base font-bold text-brand-dark">
          Start a new installation
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader>INSTALLATION REVIEW</SectionHeader>
        <div>
          <p className="text-sm text-gray-600">Customer:</p>
          <p className="text-xl font-bold">{form.fullName || '-'}</p>
          <p className="text-gray-700">{form.phone} · {form.streetAddress}</p>
        </div>
        <Equip name="CPE" serial={form.cpeSerial} source={form.cpeSerialSource} photo={form.cpePhoto} model={choiceText(form.cpeModel)} />
        <Equip name="Router" serial={form.routerSerial} source={form.routerSerialSource} photo={form.routerPhoto} model={choiceText(form.routerModel)} />
        {serialsIdentical(form) && (
          <p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 font-medium text-amber-900">⚠ {DUPLICATE_WARNING}</p>
        )}
        <dl className="divide-y divide-gray-100 border-t border-gray-200 pt-2">
          <Row k="Internet Service" v={choiceText(form.internetService)} />
          <Row k="Start Date" v={form.startDate} />
          <Row k="Installation fee" v={choiceText(form.installFee)} />
          <Row k="Router" v={choiceText(form.routerSite)} />
          <Row k="Cash Collected" v={choiceText(form.cashCollected)} />
          <Row k="Wi-Fi Name" v={form.wifiName} />
          <Row k="Wi-Fi Password" v={form.wifiPassword} />
          <Row k="Signal" v={form.signal ? `-${form.signal} dBm` : ''} />
          <Row k="Speedtest" v={form.speedtest ? `${form.speedtest} mbps` : ''} />
          <Row k="Client" v={form.clientType} />
          <Row k="Technician" v={form.technician} />
        </dl>
        <div className="flex flex-wrap gap-2">
          {STEPS.filter((s) => s.id !== 'review').map((s) => (
            <button key={s.id} type="button" onClick={() => onEdit(s.id)} className="min-h-11 rounded-full border border-gray-400 bg-white px-4 text-sm font-semibold">
              Edit {s.label}
            </button>
          ))}
        </div>
      </Card>

      {missing.length > 0 && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <p className="font-bold text-red-800">Cannot submit yet. Please fix:</p>
          <ul className="mt-2 space-y-1">
            {missing.map(([step, errs]) => (
              <li key={step}>
                <button type="button" onClick={() => onEdit(step)} className="text-left text-red-800 underline">
                  {STEPS.find((s) => s.id === step)!.label}: {Object.keys(errs).length} item{Object.keys(errs).length > 1 ? 's' : ''} missing
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button" onClick={submit} disabled={missing.length > 0}
        className="min-h-16 w-full rounded-xl bg-green-600 text-lg font-bold text-white shadow disabled:bg-gray-400"
      >
        SUBMIT INSTALLATION
      </button>
      {missing.length === 0 && (
        <Card>
          <SectionHeader>Photos</SectionHeader>
          <PhotoShare customer={form.fullName} cpeSerial={form.cpeSerial} routerSerial={form.routerSerial} />
        </Card>
      )}
      <p className="text-center text-sm text-gray-600">
        This opens WhatsApp with the details ready to send to +{WHATSAPP_NUMBER}. You then press Send in WhatsApp. The next screen lets you send the photos too.
      </p>
    </div>
  );
}
