import { useEffect, useState } from 'react';
import { canShareFiles, loadPhotoFiles } from '../utils/photos.ts';

interface Props {
  customer: string;
  cpeSerial: string;
  routerSerial: string;
}

/** Sends the CPE + router photos to WhatsApp through the phone's share sheet. */
export default function PhotoShare({ customer, cpeSerial, routerSerial }: Props) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [msg, setMsg] = useState('');
  const [urls, setUrls] = useState<string[]>([]);

  // Load the photos up front: navigator.share must run straight inside the tap (no awaiting first).
  useEffect(() => {
    let alive = true;
    loadPhotoFiles(cpeSerial, routerSerial).then((f) => alive && setFiles(f));
    return () => {
      alive = false;
    };
  }, [cpeSerial, routerSerial]);

  useEffect(() => {
    if (!files) return;
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);

  if (!files) return <p role="status" className="text-sm text-gray-600">Loading photos…</p>;
  if (files.length === 0) return <p className="text-sm text-gray-600">No photos to send.</p>;

  const shareable = canShareFiles(files);

  async function share() {
    setMsg('');
    try {
      await navigator.share({
        files: files!,
        title: 'GOLDNET installation photos',
        text: `${customer}\nCPE ${cpeSerial}\nRouter ${routerSerial}`,
      });
      setMsg('Photos shared. Make sure you chose the same GOLDNET chat and pressed Send in WhatsApp.');
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') setMsg('Could not open the share sheet. Use "Save photos" below and attach them in WhatsApp.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {urls.map((u, i) => (
          <img key={u} src={u} alt={files[i].name} className="h-20 w-20 rounded-lg border border-gray-300 object-cover" />
        ))}
      </div>
      {shareable ? (
        <button type="button" onClick={share} className="min-h-16 w-full rounded-xl bg-green-600 text-lg font-bold text-white shadow active:bg-green-700">
          📤 SEND {files.length} PHOTO{files.length > 1 ? 'S' : ''} IN WHATSAPP
        </button>
      ) : (
        <p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          This browser cannot share photos straight to WhatsApp. Save them, then attach them in the WhatsApp chat.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <a key={u} href={u} download={files[i].name} className="inline-flex min-h-11 items-center rounded-full border border-gray-400 bg-white px-4 text-sm font-semibold">
            ⬇ Save {files[i].name.startsWith('CPE') ? 'CPE' : 'router'} photo
          </a>
        ))}
      </div>
      {msg && <p role="status" className="text-sm font-medium text-gray-800">{msg}</p>}
    </div>
  );
}
