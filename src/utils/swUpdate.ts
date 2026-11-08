// Keeping installed copies of the PWA current.
//
// The service worker is registered with autoUpdate (a new version takes over and the page reloads), but the
// browser only LOOKS for a new version when the page is navigated to. An installer who keeps the app open on
// the home screen for days never navigates, so they stay on the old version. This asks for an update every
// hour while online and whenever the app comes back to the foreground.

interface Registration {
  update(): Promise<unknown>;
}

interface DocLike {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', fn: () => void): void;
}

export interface UpdateCheckOptions {
  everyMs?: number;
  /** Do not check again within this long of the previous check (foreground flaps). */
  minGapMs?: number;
  online?: () => boolean;
  doc?: DocLike | null;
}

/** Returns a function that stops the periodic checks (the visibility listener stays, it is harmless). */
export function scheduleUpdateChecks(reg: Registration, opts: UpdateCheckOptions = {}): () => void {
  const everyMs = opts.everyMs ?? 60 * 60 * 1000;
  const minGapMs = opts.minGapMs ?? 10 * 60 * 1000;
  const online = opts.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const doc = opts.doc === undefined ? (typeof document === 'undefined' ? null : document) : opts.doc;
  let last = Date.now();
  let stopped = false;
  const check = () => {
    if (stopped || !online()) return;
    last = Date.now();
    reg.update().catch(() => {
      /* offline or the server is unreachable: try again later */
    });
  };
  const id = setInterval(check, everyMs);
  doc?.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible' && Date.now() - last >= minGapMs) check();
  });
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
